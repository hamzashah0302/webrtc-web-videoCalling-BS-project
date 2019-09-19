const HTTPS_PORT = 8081;
const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const express = require("express");
const bodyParser = require('body-parser');
const path = require("path");
var cookieParser = require('cookie-parser');
var session = require('express-session');
const WebSocketServer = WebSocket.Server;
var app = express();
var exphbs  = require('express-handlebars');
const users = {}
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/users', {useNewUrlParser: true});
var Schema = mongoose.Schema;


// Authentication and Authorization Middleware
var auth = async function(req, res, next) {
  let  check_user =await UserData.findOne({'name': req.session.name})
  if (req.session && check_user!= null && req.session.admin){
    return next();}
    
  else
    return res.sendStatus(401);
};


var userDataSchema = new Schema({
  name: {type: String, required: true},
  password: String,
  friends : String
  },{collation : 'users'})
  var UserData = mongoose.model('users', userDataSchema);

// Yes, TLS is required
const serverConfig = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, '/../view'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/view' ,express.static(__dirname + '/../view'));
app.use(session({
  secret: '2C44-4D44-WppQ38S',
  resave: true,
  saveUninitialized: true
}));




    //  setting paths
// // ----------------------------------------------------------------------------------------

app.get("/",function(req,res){
  // database work here...
      
  res.render("login",{"friends":[{"name":"f11","active":true},{"name":'f22'}]});
  
})

app.get("/webrtc",auth, function(req,res){
      let id = req.session.name;
      res.render("home",{id, "friends":[{"name":"hamza","active":false},{"name":'umar',"active":true}]});
      console.log('session works =' +id)
})

app.get("/webrtc.js",function(req,res){
  res.sendFile(path.resolve(__dirname+"/../view/webrtc.js"));
})


    
// ---------------------------------------------------------------------------------------------//
      //  Manage requests from client

app.post("/submit/", (req, res) => {
  console.log("request details user name  : " ,req.body.userID+" and  password : "+ req.body.pass);
   let id = req.body.userID;
   let pass = req.body.pass;
   UserData.findOne({'name': id}, function(err , data){
    if(data!=null){
    if(data.name==id && data.password== pass){
      req.session.name= id;
      req.session.admin = true;
      res.redirect('/webrtc');
     } else res.send("Username or password is incorrect")
    }
     else {
     res.send("Entered data was incorrect")
    }
   })
})
app.get("/logout", function(req, res){
  req.session.destroy();
  console.log("session is distroy")
  res.redirect("/")
})
  
app.get('/close', function(req,res){
  res.redirect('/webrtc');
})







let httpsServer = https.createServer(serverConfig, app).listen(HTTPS_PORT)
// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({server: httpsServer});
const sendTo = (ws, message) => {
  ws.send(JSON.stringify(message))
}

    
// -----------------------------------------------------------------------------
//    Handling signals...
wss.on('connection', ws => {
  console.log('User connected')

  ws.on('message', message => {
    let data = null

    try {
      data = JSON.parse(message)
    } catch (error) {
      console.error('Invalid JSON', error)
      data = {}
    }

    switch (data.type) {
      case 'login':
        console.log('User logged', data.username)
        if (users[data.username]) {
          sendTo(ws, { type: 'login', success: false })
        } else {
          users[data.username] = ws
          ws.username = data.username
          sendTo(ws, { type: 'login', success: true })
        }
        break
      case 'offer':
        console.log('Sending offer to: ', data.otherUsername)
        if (users[data.otherUsername] != null) {
          ws.otherUsername = data.otherUsername
          sendTo(users[data.otherUsername], {
            type: 'offer',
            offer: data.offer,
            username: ws.username
          })
        }
        break
      case 'answer':
        console.log('Sending answer to: ', data.otherUsername)
        if (users[data.otherUsername] != null) {
          ws.otherUsername = data.otherUsername
          sendTo(users[data.otherUsername], {
            type: 'answer',
            answer: data.answer
          })
        }
        break
      case 'candidate':
        console.log('Sending candidate to:', data.otherUsername)
        if (users[data.otherUsername] != null) {
          sendTo(users[data.otherUsername], {
            type: 'candidate',
            candidate: data.candidate
          })
        }
        break
      case 'close':
        console.log('Disconnecting from', data.otherUsername)
        users[data.otherUsername].otherUsername = null

        if (users[data.otherUsername] != null) {
          sendTo(users[data.otherUsername], { type: 'close' })
        }

        break

      default:
        sendTo(ws, {
          type: 'error',
          message: 'Command not found: ' + data.type
        })

        break
    }
  })

  ws.on('close', () => {
    if (ws.username) {
      delete users[ws.username]

      if (ws.otherUsername) {
        console.log('Disconnecting from ', ws.otherUsername)
        users[ws.otherUsername].otherUsername = null

        if (users[ws.otherUsername] != null) {
          sendTo(users[ws.otherUsername], { type: 'close' })
        }
      }
    }
  })
})
console.log("Server runing on https://localhost:8081")

