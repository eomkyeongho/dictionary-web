const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { MongoDBNamespace } = require('mongodb');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const url = require('url');

출처: https://dololak.tistory.com/95 [코끼리를 냉장고에 넣는 방법]
require('dotenv').config();

app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride('_method'));
app.use('/public', express.static('public'));
app.use(session({secret : 'sec', resave : true, saveUninitialized : false}));
app.use(passport.initialize());
app.use(passport.session());

var db;
const MongoClient = require('mongodb').MongoClient;
app.set('view engine', 'ejs');
MongoClient.connect(process.env.DB_URL, function(err, client)
{
    if (err) return console.log(err);

    db = client.db('ToDoApp');

    app.listen(process.env.PORT, function() 
    {
        console.log('listening on 8080...');
    });
});

app.get('/', function(request, response)
{
    response.render('index.ejs');
});

app.get('/write', verification, function(request, response)
{
    response.render('write.ejs');
});

app.get('/list', verification, function(request, response)
{
    db.collection('post').find().toArray(function(err, result)
    {
        response.render('list.ejs', { posts : result });
    });
});

app.post('/add', verification, function(request, response)
{
    db.collection('counter').findOne({name:'postNum'}, function(err, result)
    {
        db.collection('post').insertOne({_id : result.totalPost + 1, title : request.body.title, date : request.body.date}, function(err, result)
        {
            db.collection('counter').updateOne({name:'postNum'}, { $inc : {totalPost:1}}, function()
            {
                response.redirect('/list');
            });
        });
    });
});

app.delete('/delete', verification, function(request, response)
{
    request.body._id = parseInt(request.body._id);
    db.collection('post').deleteOne(request.body, function(err, result)
    {
        response.status(200).send({ message : 'success'});                             
    });
});

app.get('/detail/:id', verification, function(request, response)
{
    db.collection('post').findOne({ _id : parseInt(request.params.id) }, function(err, result)
    {
        response.render('detail.ejs', { data : result});
    });
});

app.get('/edit/:id', verification, function(request, response)
{
    db.collection('post').findOne({_id:parseInt(request.params.id)}, function(err, result)
    {
        response.render('edit.ejs', { data : result});
    });
});

app.put('/edit', verification, function(request, response)
{
    db.collection('post').updateOne({ _id : parseInt(request.body._id)}, { $set : { title : request.body.title, date : request.body.date} }, function(err, result)
    {
        response.redirect(`/detail/${request.body._id}`);
    });
});

app.get('/login', function(request, response)
{
    response.render('login.ejs');
});

app.post('/login', passport.authenticate('local', {failureRedirect : '/fail'}), function(request, response)
{
    response.redirect('/');
});

app.get('/mypage', verification, function(request, response)
{
    response.render('mypage.ejs', { data : request.user.result});
});

app.get('/fail', function(request, response)
{
    response.send("<script>alert('유효하지 않은 로그인 정보입니다.'); window.location=\"/login\"</script>");
});

app.get('/search', verification, function(request, response)
{
    var _url = url.parse(request.url, true);
    var params = _url.query;

    db.collection('post').find({title : {$regex:params.data} }).toArray(function(err, result)
    {
        response.render('search.ejs', { posts : result});
    });
});

function verification(request, response, next)
{
    if(request.user) { next(); }
    else { response.send("<script>alert('로그인이 필요한 작업입니다.'); window.location=\"/login\"</script>"); }
}

passport.use(new LocalStrategy( // 로그인 유효성 검사
{
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,
}, function (input_id, input_pw, done) 
{
    db.collection('login').findOne({ id: input_id }, function (err, result) 
    {
      if (err) return done(err)
  
      if (!result) return done(null, false, { message: 'Not exist' })

      if (input_pw == result.pw) {
        return done(null, result)
      } else {
        return done(null, false, { message: 'Invalid Password' })
      }
    })
}));

passport.serializeUser(function(user, done)
{
    done(null, user.id);
});

passport.deserializeUser(function(id, done) // login 사용자 정보 가져올 때 사용
{
    db.collection('login').findOne({id : id}, function(err, result)
    {
        done(null, {result});
    });
});