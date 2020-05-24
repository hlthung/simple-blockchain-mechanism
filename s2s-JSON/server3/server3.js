/****************************************
 * Listen to client webpage (port:3002)
 ****************************************/
var express = require('express');
var app = express();
var http = require('http');
var port = 3002;
var server = http.createServer(app);
var client = require('socket.io')(server);
var sizeof = require('object-sizeof');

app.use(express.static('.'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/website.html');
});

app.set("s1_ID", null);
app.set("s2_ID", null);

client.on("connection", (socket) => {
    console.log("connected to localhost:3002");
    app.set("clientSocket", socket);

    socket.on("clientData", (data) => {
        /*>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        * scenario1: this server is the validator
        *  --> process the transaction
        * scenario2: other server is the validator 
        *  --> pass JSON data to server
        >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>*/
        
        //when all 3 servers are up and running...
        if(app.get("s1_ID") && app.get("s2_ID")){
            var serverIndex = proofOfStake([wealth_s1, wealth_s2, wealth_s3]);
            
            //server 1 is selected
            if(serverIndex === 0){
                var s1_id = app.get("s1_ID");
                //sending the data received from client to server 1
                io.to(s1_id).emit("passData", data);
            }
            //server 2 is selected
            else if (serverIndex === 1){
                var s2_id = app.get("s2_ID");
                //sending the data received from client to server 2
                io.to(s2_id).emit("passData", data);
            }
            //server 3 is selected
            else{
                if(processTransaction(data)){
                    socket.emit("updateStatus", "Successful");
                }
                else{
                    socket.emit("updateStatus", "Failure");
                }
            }
        }

        //when server 1 is not running...
        else if (app.get("s1_ID") === null && app.get("s2_ID")){
            var serverIndex = proofOfStake([wealth_s2, wealth_s3]);
            //server 2 is selected
            if(serverIndex === 0){
                var s2_id = app.get("s2_ID");
                //sending the data received from client to server 2
                io.to(s2_id).emit("passData", data);
            }
            //server 3 is selected
            else{
                if(processTransaction(data)){
                    socket.emit("updateStatus", "Successful");
                }
                else{
                    socket.emit("updateStatus", "Failure");
                }
            }
        }

        //when server 2 is not running...
        else if (app.get("s2_ID") === null && app.get("s1_ID")){
            var serverIndex = proofOfStake([wealth_s1, wealth_s3]);
            //server 1 is selected
            if(serverIndex === 0){
                var s1_id = app.get("s1_ID");
                //sending the data received from client to server 1
                io.to(s1_id).emit("passData", data);
            }
            //server 3 is selected
            else{
                if(processTransaction(data)){
                    socket.emit("updateStatus", "Successful");
                }
                else{
                    socket.emit("updateStatus", "Failure");
                }
            }
        }

        //when only this server is running...
        else if(app.get("s1_ID") === null && app.get("s2_ID") === null){
            if(processTransaction(data)){
                socket.emit("updateStatus", "Successful");
            }
            else{
                socket.emit("updateStatus", "Failure");
            }
        }

    })
})

server.listen(port, () => {
    console.log('Listening to port 3002');
});

/****************************************
 * Create socket.io server (port 8002)
 ****************************************/
var io = require('socket.io').listen(8002);

io.sockets.on("connection", (socket) => {
    //record socket.id of s1 and s2
    socket.on("identity", (data) => {
        if(data.id === "s1"){
            console.log("Server 1 has connected to this server.");
            var s1_id = socket.id;
            app.set("s1_ID", s1_id);
        }
        else{
            console.log("Server 2 has connected to this server.");
            var s2_id = socket.id;
            app.set("s2_ID", s2_id);
        }
    });

    //when server is disconnected
    socket.on("disconnect", (data) => {
        if (socket.id === app.get("s1_ID")){
            app.set("s1_ID", null);
            console.log("server 1 disconnected", socket.id);
        }

        if (socket.id === app.get("s2_ID")){
            app.set("s2_ID", null);
            console.log("server 2 disconnected", socket.id);
        }
    })
})

/****************************************
 * Connect to server 1 (port: 8000)
 ****************************************/
var io_client = require('socket.io-client');
var client_s1 = io_client.connect('http://localhost:8000');

client_s1.on("connect", () => {
    
    //identify self
    client_s1.emit("identity", {
        id: "s3"
    });

    /*>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    * scenario1: this server chosen as validator
    *  --> receives data from server 1 through event
    * "passData", process transaction
    * scenario2: server 1 is validator
    *  --> receives result of processing transaction from 
    * server 1, decides whether to update website status
    >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>*/ 

    //server 1 pass data (server 3 as validator)
    client_s1.on("passData", (data) => {
        console.log(sizeof(data));//SIZE COMPARISON
        processTransaction(data, "s1");
    });

    //successful transaction (server 1 as validator)
    client_s1.on("updateBlock", (data) => {
        var socket = app.get("clientSocket");
        //update wealth of validator
        wealth_s1 = data.wealth;
        transaction.addBlock(new Block(data.timeStamp, data.data));
        console.log(JSON.stringify(transaction, null, 4));
        //update status of website
        if(data.updateWebsite){
            socket.emit("updateStatus", "Successful");
        }
    });

    //failed transaction(server 1 as validator)
    client_s1.on("failTransaction", (data) => {
        var socket = app.get("clientSocket");
        socket.emit("updateStatus", "Failure");
    });

})
/****************************************
 * Connect to server 2 (port: 8001)
 ****************************************/
var client_s2 = io_client.connect('http://localhost:8001');

client_s2.on("connect", () => {

    //identify self
    client_s2.emit("identity", {
        id: "s3"
    });

    /*>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    * scenario1: this server chosen as validator
    *  --> receives data from server 2 through event
    * "passData", process transaction
    * scenario2: server 2 is validator
    *  --> receives result of processing transaction from 
    * server 2, decides whether to update website status
    >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>*/ 

    //server 2 pass data (server 3 as validator)
    client_s2.on("passData", (data) => {
        processTransaction(data, "s2");
    });

    //successful transaction (server 2 as validator)
    client_s2.on("updateBlock", (data) => {
        var socket = app.get("clientSocket");
        //update wealth of validator
        wealth_s2 = data.wealth;
        transaction.addBlock(new Block(data.timeStamp, data.data));
        console.log(JSON.stringify(transaction, null, 4));
        //update status of website
        if(data.updateWebsite){
            socket.emit("updateStatus", "Successful");
        }
    });

    //failed transaction(server 2 as validator)
    client_s2.on("failTransaction", (data) => {
        var socket = app.get("clientSocket");
        socket.emit("updateStatus", "Failure");
    });

})

 /*********************************************
 * Initialize BlockChain & servers' wealth
 ********************************************/
 var SHA256 = require('crypto-js/sha256');
 var wealth_s1 = 1;
 var wealth_s2 = 3;
 var wealth_s3 = 5;
 
 class Block{
     constructor(timeStamp, data, prevHash = "") {
         this.timeStamp = timeStamp;
         this.prevHash = prevHash;
         this.data = data;
         this.hash = this.calculateHash();
     }
 
     calculateHash(){
         return SHA256(this.timeStamp + this.prevHash + JSON.stringify(this.data)).toString();
     }
 }
  
 class BlockChain{
     constructor(){
         //initial block (genesis block)
         this.chain = [this.createGenesisBlock()];
     }
  
     createGenesisBlock(){
         var data = {
            from: "",
            to: "",
            amount: 0,
            desc: ""
         };
         return new Block("00", data);
     }
 
     getLatestBlock(){
         return this.chain[this.chain.length-1];
     }
 
     addBlock(newBlock){
         newBlock.prevHash = this.getLatestBlock().hash;
         newBlock.hash = newBlock.calculateHash();
         this.chain.push(newBlock);
     }
 
     isChainValid(){
         for(var i=1; i<this.chain.length; i++){
             var currentBlock = this.chain[i];
             var prevBlock = this.chain[i-1];
             if(currentBlock.hash != currentBlock.calculateHash()){
                 return false;
             }
 
             if(currentBlock.prevHash != prevBlock.hash){
                 return false;
             }
         }
 
         return true;
     }

     //loops through all blocks to determine if transaction is valid
     checkBalance(newBlock){
        var sender = newBlock.from.toUpperCase();
        var receiver = newBlock.to.toUpperCase();
        var amountLeft = 0;
        if(sender === "C1"){
            if(receiver === "C2"){
                //setting initial amount
                amountLeft = this.chain[1].data.amount;
            }
            else{
                return false;
            }
        }
        else if(sender === "C2"){
            if(receiver === "C1"){
                //setting initial amount
                amountLeft = this.chain[2].data.amount;
            }
            else{
                return false;
            }
        }
        else{
            //when there is no such client in the chain
            return false;
        }
        //loop through block chain to find the balance of sender
        for(var i=3; i<this.chain.length; i++){
            if(this.chain[i].data.from.toUpperCase() === sender){
                amountLeft -= parseFloat(this.chain[i].data.amount);
            }
            if(this.chain[i].data.to.toUpperCase() === sender){
                amountLeft += parseFloat(this.chain[i].data.amount);
            }
        }
        //if sender has enough balance, return true
        if(amountLeft >= newBlock.amount){
            return true;
        }
        else{
            return false;
        }
    }
 }
 
 var transaction = new BlockChain();
 //pre-defined constants
 transaction.addBlock(new Block("01", {
    from: -1,
    to: "C1",
    amount: 100,
    desc: "Open Bal: C1"
 }));
 
 transaction.addBlock(new Block("02", {
    from: -1,
    to: "C2",
    amount: 150,
    desc: "Open Bal: C2"
 }));
 

/****************************************************************
 * Function: Proof of Stake 
 * input: list of servers' wealth
 * output: index of selected server [0, 1, 2]
 *****************************************************************/
var random = require('random-js')();
function proofOfStake(serverList){
    var totalWealth = 0;
    for(var i=0; i<serverList.length; i++){
        totalWealth += serverList[i];
    }
    var selectedIndex = -1;
    var rand = random.integer(1, totalWealth);
    while(rand>0){
        selectedIndex += 1;
        rand = rand - serverList[selectedIndex];
    }
    return selectedIndex;
}

/************************************************
 * Function: processTransaction
 * input: JSON object, server sending the data
 * output: boolean 
 * result: update servers regarding result
 ************************************************/
function processTransaction(newBlock, sendingServer=""){
    var s1_id = app.get("s1_ID");
    var s2_id = app.get("s2_ID");
    //if there is enough balance to make transaction
    if(transaction.checkBalance(newBlock)){
        //add block
        transaction.addBlock(new Block(Date(), newBlock));
        //update wealth
        wealth_s3 += 3;
        var timeStamp = transaction.getLatestBlock().timeStamp;
        //update two other servers
        //when you need to inform sending server to update their website
        if(sendingServer === "s1"){
            io.to(s1_id).emit("updateBlock", {
                timeStamp: timeStamp,
                data: newBlock, 
                wealth: wealth_s3,
                updateWebsite: true
            });

            io.to(s2_id).emit("updateBlock", {
                timeStamp: timeStamp,
                data: newBlock,
                wealth: wealth_s3,
            });
        }
        else if(sendingServer === "s2"){
            io.to(s1_id).emit("updateBlock", {
                timeStamp: timeStamp,
                data: newBlock, 
                wealth: wealth_s3,
            });

            io.to(s2_id).emit("updateBlock", {
                timeStamp: timeStamp,
                data: newBlock,
                wealth: wealth_s3,
                updateWebsite: true
            });
        }
        //when those servers do not need to update their website
        else if(sendingServer === ""){
            io.to(s1_id).emit("updateBlock", {
                timeStamp: timeStamp,
                data: newBlock, 
                wealth: wealth_s3,
            });

            io.to(s2_id).emit("updateBlock", {
                timeStamp: timeStamp,
                data: newBlock,
                wealth: wealth_s3,
            });
        }
        
        console.log(JSON.stringify(transaction, null, 4));
        return true;
    }
    //when transaction failed
    else{
        if(sendingServer === "s1"){
            io.to(s1_id).emit("failTransaction", {
                message: "failed"
            });
        }
        else if(sendingServer === "s2"){
            io.to(s2_id).emit("failTransaction", {
                message: "failed"
            });
        }
        return false;
    }
}
