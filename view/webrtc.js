//import { sign } from "crypto";
let connection = null

let name ;
let otherUsername = null
var ws;
const HTTPS_PORT = 8081;
let other_username_for_msg = '';
let searched_friend_name = null;

var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.stunprotocol.org:3478'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};
//  send message when enter button pressed
$("#text_message").keypress(function(event) {
  if (event.which == 13) {
    if(!other_username_for_msg){return alert("please select a user to send message") 
     }
     else texting();
 }
});
function texting(){
  if(!other_username_for_msg){return alert("please select a user to send message")  } 
  var txt = document.getElementById("text_message");
  
  sendMessage({
    type: 'texting',
    text: txt.value,
    other_username : other_username_for_msg,
    from : name
  })
  $(function(){
    message_show = $('#message_show')
     message_show.append('<div>' +' me : '+ txt.value+ '</div>')
    // console.log("check it dude :" +txt.value)
  })
  setTimeout(function(){txt.value =''},1000) ;
}

ws = new WebSocket('wss://' + window.location.hostname + ':'+HTTPS_PORT);
connection = new RTCPeerConnection(peerConnectionConfig);
const sendMessage = message => {
  if (otherUsername) {
    message.otherUsername = otherUsername
  }

 ws.send(JSON.stringify(message))
}
ws.onmessage = async msg => {
  const data = JSON.parse(msg.data)
    if (data.type === 'offer'){
     let a = await window.confirm("Accept incomming call ?");
   if(!a)
    return;
   }
  switch (data.type) {
    
    case 'login':
      handleLogin(data.success)
      break
    case 'offer':
      handleOffer(data.offer, data.username)
      break
    case 'answer':
      handleAnswer(data.answer)
      break
    case 'candidate':
      handleCandidate(data.candidate)
      break
    case 'close':
      handleClose()
      location.reload(true);
      break
    case 'texting':
    handletext(data); 
    console.log(data.text);
    break

    case 'searched_friend':
      handle_searched_friend(data);
    break
    case 'message_history':
      handleHistory(data)
      break
    default:
      break
  }
}
document.getElementById("close-call").style.display= "none"

var constraints = {
  video: {
    width: { min: 220, ideal: 500 },
    height: { min: 220, ideal: 500 },
    aspectRatio: { ideal: 1.7777777778 }
  },
  audio: {
    sampleSize: 16,
    channelCount: 2
  }
};

const handleLogin = success => {
  if (success === false) {
    alert('😞 Username already taken')
  } else {
     
  console.log("your logged in" );
        }
}

 
const handleOffer = async (offer, username) => {
 await getMedia();
  otherUsername = username
      connection.setRemoteDescription(new RTCSessionDescription(offer))
  connection.createAnswer(
    answer => {
      connection.setLocalDescription(answer)
      sendMessage({
        type: 'answer',
        answer: answer
      })
    },
    error => {
      alert('Error when creating an answer')
      console.error(error)
    }
  )
}

const handleCandidate = candidate => {
  connection.addIceCandidate(new RTCIceCandidate(candidate))
 
 
}

const handleAnswer = answer => {
  connection.setRemoteDescription(new RTCSessionDescription(answer))
}

const handleClose = () => {
  otherUsername = null
   document.querySelector('video#remote').src = null
  
  connection.close()
  connection.onicecandidate = null
  connection.onaddstream = null

}
function handletext(txt){
  $(function(){
    message_show = $('#message_show')
    message_show.append('<div>'+txt.from +' : '+ txt.text+ '</div>')
  })
  }
function handle_searched_friend(data){
if(data.name!=null){
  
  $(function(){
    $("#add_friend").removeClass("hide")
    searched_friend_name = data.name
   $("#searched_friend").append("<h6>"+data.name+"</h6>");
  })
}
else{
  $("#add_friend").addClass("hide")
  $("#searched_friend").append("<h6>No result found on Searched data</h6>")
}
}

function handleHistory(params) {
  username = document.querySelector('input#user_id').value
  params.messages.forEach(element => {
    console.log("got history :"+ element.message)
    $(function(){
      message_show = $('#message_show')
      if(element.name==username)
      message_show.append('<div>'+ 'Me'+' : '+ element.message+ '</div>')
      else
      message_show.append('<div>'+ element.name+' : '+ element.message+ '</div>')
    })
  });
  
}

async function getMedia(){
  document.getElementById("close-call").style.display= "block"
  let localStream
  try {
    localStream =await navigator.mediaDevices.getUserMedia(constraints)
  } catch (error) {
    alert(`${error.name}`)
    console.error(error)
  }
  document.querySelector('video#local').srcObject = localStream;
  connection.addStream(localStream)
console.log("stream is added to peer")
  
}
connection.onaddstream = event => {
  document.querySelector('video#remote').srcObject = event.stream
  console.log("Got remote stream ");
}

connection.onicecandidate = event => {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      candidate: event.candidate
    })
  }
}


//  getting user name for login in p2p server..
 
function get_user_name() {
    username = document.querySelector('input#user_id').value
    name =username;
  sendMessage({
    type: 'login',
    username: username
  })
  console.log("log in success to p2p server " +username)
}

async function get_otherUser_toCall(otheruser_name){
 
  console.log("Other User name is gotten = "+ otheruser_name);
  await getMedia();

  if (otheruser_name.length === 0) {
    alert('Enter a username 😉')
    return
  }
  otherUsername = otheruser_name
  

  connection.createOffer(
    offer => {
      sendMessage({
        type: 'offer',
        offer: offer
      })

      connection.setLocalDescription(offer)
    },
    error => {
      alert('Error when creating an offer')
      console.error(error)
    }
  )
}
function get_otheruser_to_msg(value){
  other_username_for_msg = value;
  username = document.querySelector('input#user_id').value
  let txt_clear = document.getElementById("message_show");
  txt_clear.innerHTML='';
  // getting previous message history and signal to server
   sendMessage({
     type: 'message_history',
     username: username,
     othername: other_username_for_msg
  })

}


// search friend 
$(document).on("click", "#search_friend" , function(){
   $("#searched_friend").empty();
  search_friend_txt = $("#search_friend_txt").val();
  username = document.querySelector('input#user_id').value
  $("#div_searched_friend").removeClass("hide")
  $("#div_searched_friend").addClass("show")
  sendMessage({
    type: 'friend_search',
    find_username: search_friend_txt,
    username : username})
     $("#search_friend_txt").val("");
  })

  // add friend
  $(document).on("click","#add_friend",function(){
    username = document.querySelector('input#user_id').value
   let add_friend_name = searched_friend_name;
   sendMessage({type: 'add_friend',
  othername: add_friend_name, username: username})
   searched_friend_name = null;
   $(this).addClass("hide")
   console.log(" add funnction called")
   setTimeout(function(){location.reload(true)} , 2000); 
  })



  // close div_searched_friend div 
  $(document).on("click","#close_div",function(){
    $("#div_searched_friend").addClass("hide")

  })