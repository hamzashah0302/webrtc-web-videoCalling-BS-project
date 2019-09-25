//import { sign } from "crypto";
let connection = null
let name = null
let otherUsername = null
var ws;
const HTTPS_PORT = 8081;

var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.stunprotocol.org:3478'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};
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
    default:
      break
  }
}
document.getElementById("close-call").disabled= "disabled"

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
     
    // document.querySelector('div#call').style.display = 'block'
  console.log("your logged in" );
        }
}

 
const handleOffer = async (offer, username) => {
  // document.querySelector('div#video').style.display = 'block';
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

async function getMedia(){
  document.getElementById("close-call").disabled= false
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