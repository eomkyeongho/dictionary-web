const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { MongoDBNamespace } = require('mongodb');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

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
        var dataSet = {_id : result.totalPost + 1, title : request.body.title, date : request.body.date, name : request.user.result.name, user_id : request.user.result._id};
        db.collection('post').insertOne(dataSet, function(err, result)
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
    if(request.body.post_user_id == request.user.result._id)
    {
        request.body.post_num = parseInt(request.body.post_num);
        db.collection('post').deleteOne({_id : request.body.post_num}, function(err, result)
        {
            response.status(200).send({ message : 'success'});                             
        });
    }
    else
    {
        response.status(400).send({ message : 'not valid'});
    }
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
    db.collection('post').findOne({_id : parseInt(request.params.id), user_id : request.user.result._id}, function(err, result)
    {
        if(!result) 
        {
            response.send(`<script>alert('해당 게시물 작성자가 아닙니다.'); window.location="/detail/${request.params.id}"</script>`);
        }
        else
        {
            response.render('edit.ejs', { data : result});
        }
    });
});

app.put('/edit', verification, function(request, response)
{
    db.collection('post').updateOne({ _id : parseInt(request.body._id), user_id : request.user.result._id }, { $set : { title : request.body.title, date : request.body.date} }, function(err, result)
    {
        if(!result) 
        {
            response.send(`<script>alert('해당 게시물 작성자가 아닙니다.'); window.location="/detail/${request.params.id}"</script>`);
        }
        else
        {
            response.redirect(`/detail/${request.body._id}`);
        }
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

app.get('/register', function(request, response)
{
    response.render('register.ejs');
});

app.post('/register', function(request, response)
{
    if(!request.body.name || !request.body.id || !request.body.pw || !request.body.pw_confirm)
    {
        response.send("<script>alert('필수 입력 항목이 입력되지 않았습니다.'); window.location=\"/register\"</script>");
    }
    else if(request.body.pw != request.body.pw_confirm)
    {
        response.send("<script>alert('비밀번호가 일치하지 않습니다.'); window.location=\"/register\"</script>");
    }
    else
    {
        db.collection('login').insertOne({ id : request.body.id, pw : request.body.pw, name : request.body.name }, function(err, result)
        {
            response.send("<script>alert('회원 가입 완료'); window.location=\"/login\"</script>");
        });
    }
});

app.get('/mypage', verification, function(request, response)
{
    var searchCondition = [{$search : {index : 'idSearch', text : { query : request.user.result._id, path : "user_id"}}}];
    console.log(request.user.result._id);
    db.collection('post').aggregate(searchCondition).toArray(function(err, result)
    {
        console.log(result);
        response.render('mypage.ejs', { posts : result});
    });
});

app.get('/fail', function(request, response)
{
    response.send("<script>alert('유효하지 않은 로그인 정보입니다.'); window.location=\"/login\"</script>");
});

app.get('/search', verification, function(request, response)
{
    var searchCondition = [{$search : {index : 'titleSearch', text : { query : request.query.data, path : "title"}}}];
    db.collection('post').aggregate(searchCondition).toArray(function(err, result)
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