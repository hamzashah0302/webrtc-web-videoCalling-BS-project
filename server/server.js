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
  friends : [{name : String}]
  },{collation : 'users'})
  var UserData = mongoose.model('users', userDataSchema);

// messages Schema

  var userMessagesSchema = new Schema({
  names : [{name1 : String, name2: String}],
  text : [{name :String , message: String}]}
  ,{collation : 'messages'})

  var UserMessages = mongoose.model('messages', userMessagesSchema);


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
        // messaging 
        case 'texting':
          let sender = data.from
          let receiver = data.other_username
          if(users[data.other_username]==undefined){
            
          console.log("user is offline and the message is store in databse ")
          }
         else{
             console.log("ur msg is : "+data.text+" and u want to send to :"+ data.other_username);
            sendTo(users[data.other_username], {type : 'texting', text:data.text , from:data.from})
          }
          UserMessages.findOne({$or:[{'names': {$elemMatch: {name1: sender, name2:receiver}}},{ 'names':{$elemMatch:{name1:receiver, name2:sender}}}]}, function(err , doc)
          {
            if(err)return console.log("Error :"+ err);
            let check = doc            
            // if undefined then create new document
            if(check ==undefined){
              UserMessages.create({names:{ name1: sender, name2: receiver },text:{name:sender, message: data.text}}, function (err, data) {
                if(err)console.log("Error in storing message:"+err)
                else
                console.log("doc created and Message store successfully in db :" )
              }) 
            }
            else {
              // console.log(" name got : "+ check.names[0].name1)
              UserMessages.findOneAndUpdate(
                { names: {$elemMatch:{name1: check.names[0].name1, name2:check.names[0].name2 } }},   
                { $push: { text:{ name: sender, message: data.text  }} },
               function (error, success) {
                 if(error){console.log("Error : "+error)}
                 else{console.log("Message saved db :")}
            })
          }
          })


        break

        // search friend
        case 'friend_search':
          let find_username = data.find_username;
          let username = data.username
            UserData.findOne({name: find_username}, function(err , doc){
             if(err)return res.sendStatus(401);
             if(doc!=null)
             sendTo(users[username] , {type :"searched_friend" ,name:doc.name})
             else{
              sendTo(users[username],{type:"searched_friend", name:null})
             }

            })
        break

        // add friend in friend list of a user
       case 'add_friend':
          // console.log(" add funnction called")
         UserData.findOne({'name': data.username},function(err, doc){
           var check = doc.friends;
           let c = false;
          //  check if user already added to friend list
           check.forEach(element => {
             if(data.othername==element.name){ c = true }
           });

          if(c==false){
           UserData.findOneAndUpdate(
            { name: data.username }, 
            { $push: { friends:{ name: data.othername  }} },
           function (error, success) {
                 if (error) {
                     console.log(error);
                 } else {
                     console.log("friends added success");
                 }});
                //  save data to other user table too
                UserData.findOneAndUpdate(
                  { name: data.othername }, 
                  { $push: { friends:{ name: data.username  }} },
                 function(err, doc){
                 if(err) console.log(" error : "+err)
                 else console.log(" friends added to other table too ")
                 })}

          else console.log("user already added...");       
         })   
      
       break;
       case 'message_history':
         let other_username = data.othername
         let name = data.username
         UserMessages.findOne({$or:[{'names': {$elemMatch: {name1: name, name2:other_username}}},{ 'names':{$elemMatch:{name1:other_username, name2:name}}}]},
          function(err , doc)
          {
            if(err)return console.log("Error :"+ err);
            if(doc!==null){
            let history = doc.text;
            sendTo(users[name] , {type :"message_history" ,messages : history})
          } else {
            return console.log("No History found");
          }
        })
       break;

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