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
let check_active_user =[];
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/users', {useNewUrlParser: true});
var Schema = mongoose.Schema;
// Yes, TLS is required
const serverConfig = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};


// Authentication and Authorization Middleware
var auth = async function(req, res, next) {
  let  check_user =await UserData.findOne({'name': req.session.name})
  if (req.session && check_user!= null && req.session.admin){
    return next();}
    
  else
    return res.sendStatus(401);
};

// Schema design --------------
var userDataSchema = new Schema({
  name: {type: String, required: true},
  password: String,
  friends : [{name : String}],
  messages :[{name: String, msg : String , data: Date}]
  },{collation : 'users'})
  var UserData = mongoose.model('users', userDataSchema);

    

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
  
      
  res.render("login");
  
})


app.get("/webrtc",auth, function(req,res){
    //  retrieve user data from db
      let id = req.session.name;
      UserData.findOne({name: id}, function(err , data){ 
      if(err)res.send("No user found ")
      else 
      var user_friends = data.friends; 
      var messages = req.query.msg
      res.render("home",{id, messages, user_friends});
      console.log('session works =' +id)
       
      })
})


app.get("/webrtc.js",function(req,res){
  res.sendFile(path.resolve(__dirname+"/../view/webrtc.js"));
})

app.get('/sign_up', function(req,res){
  res.render("sign_up")

})

app.get("/close" , function(req, res){
  res.redirect("/webrtc")
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
app.get("/logout",async function(req, res){
  req.session.destroy();
  console.log("session is distroy")
  res.redirect("/")
})

// sign_up  
app.post("/sign_up", function(req, res){
let new_user = req.body.new_user;
let pass = req.body.pass;
let check_user;
UserData.findOne({'name': new_user}, function(err , user){
  if(err) res.send("error in retriving data");{
    if(user) res.send("user name is already taken ")
    else{
      UserData.create({name: new_user, password: pass}, function (err, data) {
        if (err) {
          console.log('could not insert')
          throw err
        }
        console.log('inserted account : ' +data)
       res.redirect("/");
      })

    } 
  }
    });


 

})

// messages from db
app.get("/message", function(req,res){
  let user = req.session.name
  var user_messages =[];
  UserData.findOne({name: user}, function(err , data){ 
    if(err)res.send("No data found ")
    else {
      data.messages.forEach(element => {
        if(element.name== "umar")
        user_messages.push(element);
      });
      console.log("check messages : "+ user_messages)
       
    
    // user_messages.forEach(element => {
    //  console.log("Mesages data are here :" + element) 
    // });
  }
})
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

        case 'test':
          if(users[data.other_username]==undefined){
          console.log("user is offline and the message is store in databse ")
          }
         else{
             console.log(data.text+" and u want to send to :"+ data.other_username);
            sendTo(users[data.other_username], {type : 'test', text:data.text , from:data.from})}
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


// setInterval(function(){
//   check_active_user.forEach(function(user){
//     if(user.readyState === WebSocket.OPEN)
//     console.log("active are here "+ user);
//   })
//  }, 3000);