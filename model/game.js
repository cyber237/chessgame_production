
const mongoose=require('mongoose');
const  moment = require('moment');

const GameRoundSchema=mongoose.Schema({
    players:[{username:{type:String,default:""},connected:{type:Boolean,default:false},initiator:{type:Boolean,default:false},}],
    code:String,
    messages:[{datetime:Number,author_id:String,content:String,}],
    current_state:{type:String,default:""},
    
    game_start:Number,
});


GameRoundSchema.statics.join_game=async function(playername,gamecode) {
    var response={"sucess":false,"game_state":undefined,"messages":undefined,"players":undefined,"description":"Invalid game code"};
    var game = await this.findOne({code:gamecode}).exec();
    if (!game){
        console.log("error adding player");
        return response;

    } 
    if(playername==="system"){
        response.description="\"system\" is a reserved name";
        return response;
    }

    if (game.players.some(e => e.username === playername && !e.connected) ) {
        response["game_state"]=game.current_state;
        response["players"]=game.players;
        response["sucess"]=true;
        response["messages"]=game.messages;
        response["description"]="";
        console.log("player re-loggedin");
    }else if(game.players.some(e => e.username === playername && e.connected)){
        response["sucess"]=false;
        response["description"]="User already connected";
        console.log("player already connected");


    }   
    else if( game.players.length<=1){
        const player={username:String(playername),connected:false,initiator:false};
        game.players.push(player);
        game.save();
         
        response["game_state"]=game.current_state;
        response["players"]=game.players
        response["sucess"]=true;
        response["messages"]=game.messages;
        response["description"]="";
        console.log("player added to game");
        
    }
    else{
        response["description"]="Player name invalid or maximum players exceeded!";
        console.log("error adding player");
    }   
        
    return response;

    
}

GameRoundSchema.statics.start_game=function(playername) {
    var game_code=String(new mongoose.Types.ObjectId());
    let currentTime=moment().unix();
    var game_round=new GameRound({code:game_code,players:[{username:playername,connected:false,initiator:true}],game_start:currentTime});
    game_round.save();
 
    return game_round;  
}


GameRoundSchema.methods.add_message=function(data){
    var currentTime=moment().unix();
    var message={datetime:currentTime,author_id:data.author_id,content:data.content};
    this.messages.push(message);
    this.save();
    return message;
}

const GameRound=mongoose.model("GameRound",GameRoundSchema);
module.exports=GameRound
