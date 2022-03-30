
const express = require('express');
var cors = require('cors');

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json()
var GameRound=require('./model/game');
var mongoose = require('mongoose');

const NodeCache = require( "node-cache" );
const myCache = new NodeCache();
const host = '0.0.0.0';
const port = process.env.PORT || 3000;


var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

var url = "mongodb+srv://chessgame:VhOIfjxSoI6RzYlu@chessdb.ss2us.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
mongoose.connect(url).then((_)=>console.log("Connected to mongodb atlas"));



const app = express()
  , server = require('http').createServer(app)
  , io = require("socket.io")(server,  {cors:corsOptions});

app.use(cors());
app.use(express.static(process.cwd()+"/public/"));

app.get('*', (req,res) => {
  res.sendFile(process.cwd()+"/public/index.html")
});

app.post('/join-game',jsonParser, async (req, res,next) => {
  let data=req.body;
  var result = await GameRound.join_game(data.username,data.code);
  console.log(result);
  res.send(result);
});

app.post('/new-game',jsonParser, (req, res, next) => {
  console.log(req.body);
  let username=req.body.username;
  var round = GameRound.start_game(username);
  console.log(`game code: ${round.code}`)
  res.send({code:`${round.code}`,messages:JSON.stringify(round.messages),players:JSON.stringify(round.players),state:round.state});
});



io.on("connection",(socket)=>{
  // clear rooms user is in , its purpose is to remove user socket id from rooms
  socket.rooms.size=0;

  console.log("user connected");
  socket.on("chatmessage",async(msg)=>{
    let round=await GameRound.findOne({code:socket.data.code}).exec();
    if (!round) return console.log("Error occured when fetching room");
    msg=round.add_message(msg);
    io.to(socket.data.code).emit("chatmessage",{"message":msg,"messages":round.messages});



  });

  socket.on("update-board-state",async(data)=>{
    console.log(socket.data.code);
    let round = await GameRound.findOne({code:socket.data.code}).exec();
      
      if (!round) return console.log("Error updating board");
      console.log(data);
      try {
        round.current_state=data.state;
        
        round.save();
        
        io.to(socket.data.code).emit("move",data);
      } catch (error) {
        console.log(error);
        
      }

  });

  socket.on("reset",async(data)=>{
    console.log(socket.data.code);
    let round = await GameRound.findOne({code:socket.data.code}).exec();
      
    if (!round) return console.log("Error updating board");
    console.log(data);
    try {
      round.current_state=data.state;
      round.messages.push({id:"",content: "Game resetted",datetime: 0,author_id:"system"});
      
      round.save();
      data["player"]=socket.data.username;
      myCache.set(`${socket.data.code}-status`,"na");
      
      io.to(socket.data.code).emit("reset",data);
      
      io.to(socket.data.code).emit("chatmessage",{"messages":round.messages});
    } catch (error) {
      console.log(error);
      
    }
      

  });

  socket.on("checkmate",async(data)=>{

    io.to(socket.data.code).emit("checkmate",data);



  });

  socket.on("stalemate",async(data)=>{

    io.to(socket.data.code).emit("stalemate",data);


  });

  socket.on("join-game",async (data)=>{
    let round = await  GameRound.findOne({code:data.code}).exec();
    if (!round) return console.log("Error joining game");
    round.players.forEach(player => {
      if (player.username==data.username){
        player.connected=true;
        socket.data.username=data.username;
        socket.data.code=data.code;
        socket.join(data.code);
        console.log("player joined");
      }
      
    });
    round.messages.push({id:"",content: `Player ${data.username} joined game`,datetime: 0,author_id:"system"});
    round.save();
      
    io.to(data.code).emit("new-player",{players:round.players,player:data.username},);
    io.to(socket.data.code).emit("chatmessage",{"messages":round.messages});


  });

  socket.on("disconnect",async(_)=>{
    if(socket.data.username && socket.data.code){
      let round=await GameRound.findOne({code:socket.data.code}).exec();
      if (!round) return console.log("Error updating board");
      round.players.forEach(player => {
        if (socket.data.username==player.username){
          player.connected=false;
        }
      });
      round.messages.push({id:"",content: `Player ${socket.data.username} left game`,datetime: 0,author_id:"system"});
      round.save();
      io.to(socket.data.code).emit("leave",{player:socket.data.username,players:round.players});
      io.to(socket.data.code).emit("chatmessage",{"messages":round.messages});

    }
    
  });

});





server.listen(port,host,()=>{
  console.log(`Listening on port ${port}`)
});

