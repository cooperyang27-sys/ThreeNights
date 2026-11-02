const startPower = 100
const baseDrainRate = 0.1
const usagePenalty = 0.4
const tickRate = 1000     
const nightLength = 120   
const MoveInterval = 4000 

const ROOMS = {
    gym: { name: "Gymnasium", description: "The animatronics sit here." },
    bleachers: {name: "Bleachers", description: "Where people usually watch games"},
    foyer: { name: "Foyer", description: "The room in between the gym and the hallway"},
    commons: {name: "10th Floor Commons", description: "The commons"}, 
    hallway: { name: "West Hallway", description: "A dark corridor leading to 1003." },
    door: { name: "Door", description: "The door to 1003" },
    classroom: { name: "Room 1003", description: "You are here." },
    elevator: { name: "South Elevators", description: "Chris is coming..." }
};


// Ordered list of room IDs (used for camera cycling)
const ROOM_IDS = ['gym','bleachers','foyer','commons', 'elevator', 'hallway']; //not door, not classroom because door is default and classroom is not a view

class Animatronic {
    constructor(name, path, difficulty) { //equivalent to __init__ 
        this.name = name; //self.name basically
        this.path = path; //path is an array
        this.pathIndex = 0; //which room they are in
        this.difficulty = difficulty; 
    }

    attemptMove() {
        const roll = Math.floor(Math.random() * 20) + 1; //Rolls a d20. Math.random gives 0 ≤ value < 1
        if (this.name == "Welly" && gameEngine.state.currentCamera == this.getLocation() && gameEngine.state.isCameraOpen == true){
            console.log("Welly has been blocked since you are looking at him");
            return false;
        }
        if (this.name == 'CHRIS!!!' && roll <= this.difficulty) {
            // If CHRIS triggered his move roll, start the 9s timer
            if (this.pathIndex < this.path.length - 1) {
                if (!gameEngine.state.chrisTimerActive) {
                    this.playMoveSound(this.name);
                    gameEngine.startChrisTimer(this);
                }
            }
            return false; // movement deferred until timer completes
        } else{
            if (roll <= this.difficulty) { //difficulty can go to 20. At 20 it will move every roll
                if (this.pathIndex < this.path.length - 1) { 
                    this.pathIndex++; //if it's not in the last room, move forward
                    console.log(`${this.name} moved to ${this.path[this.pathIndex]}`);
                    this.playMoveSound(this.name);
                    return true; //moved
                }
            }
        }


        return false; //otherwise don't move
    }

    playMoveSound(enemy) {
    const sound = document.getElementById('snd-move');
    if (sound) {
        sound.src = `${enemy}.m4a`
        sound.load(); //Without this, sound might not play since it takes a bit to load
        sound.currentTime = 0; // Restart sound if it's already playing
        sound.play().catch(e => console.log("Sound play prevented:", e));
        }
    }

    getLocation() { 
        return this.path[this.pathIndex];
    }

    reset() {
        this.pathIndex = 0;
    }
}

const gameEngine = {
    state: {
        power: startPower,
        timeElapsed: 0,
        usage: 1,
        isCameraOpen: false,
        currentCamera: 'gym', 
        doorOpen: true,
        blindsOn: false,
        gameOver: false,
        chrisTimerActive: false,
        chrisTimerId: null
    },

    enemies: [
        //Welly can move to 3 different places, move with roll < 5
        new Animatronic("Welly", ['gym', 'foyer', 'commons', 'hallway', 'door', 'classroom'], 4),
        new Animatronic("SamFerradiddler", ['gym', 'bleachers', 'foyer', 'hallway', 'door', 'classroom'], 4),
        new Animatronic("CHRIS!!!", ['elevator', 'classroom'], 3)
    ],

    intervals: [], 
    // Minimal level queue: each entry is an array of enemy config objects {name, path, difficulty}
    queuedLevels: [
        //starts at lvl1 so this is lvl2
        [{name: "Welly", path: ['gym', 'foyer', 'commons', 'hallway', 'door', 'classroom'], difficulty: 5},
        {name: "SamFerradiddler", path: ['gym', 'bleachers', 'foyer', 'hallway', 'door', 'classroom'], difficulty: 4}], 

        [{name: "Welly", path: ['gym', 'foyer', 'commons', 'hallway', 'door', 'classroom'], difficulty: 6},
        {name: "SamFerradiddler", path: ['gym', 'bleachers', 'foyer', 'hallway', 'door', 'classroom'], difficulty: 5},
        {name: "CHRIS!!!", path: ['elevator', 'classroom'], difficulty:3}]

    ],
    currentQueuedLevelIndex: -1, //starts at -1 because first thing that happens is cQLI+=1

    init() { //START FUNCTION
        document.querySelector("#start-screen").style.display = "none"
        this.startLoop();
        this.updateUI();
        // Attempt to initialize map image display after UI is available
        this.initMapImage();
        console.log("Game Initialized");
    },

    startLoop() { //GAME LOOP 
        const mainTick = setInterval(() => {
            this.handlePower();
            this.handleTime();
            this.updateUI();
        },  tickRate); //tickrate moveable I think, tickrate is ms between each action

        const aiTick = setInterval(() => { //two different loops, one for general, one for ai
            this.handleAI();
            this.updateUI();
        }, MoveInterval);

        this.intervals.push(mainTick, aiTick); //pushes the intervals to intervals array 
    },

    // Attempt to load the map image and show it if available
    initMapImage() {
        const mapEl = document.getElementById('map');
        const src = mapEl.getAttribute('src');
        const img = new Image();
        img.onload = () => { mapEl.style.display = 'block';};
        img.onerror = () => { mapEl.style.display = 'none';};
        img.src = src;
    },

    startChrisTimer(chris) {
        if (this.state.chrisTimerActive) return;//only start 1 timer
        this.state.chrisTimerActive = true;
        console.log("CHRIS IS MOVING!!!")
        this.updateUI()
        //show video if player is watching hallway; updateUI will start playback
        this.state.chrisTimerId = setTimeout(() => { //setTimeout() runs inside after 8000ms
            //finalize move
            if (chris.pathIndex < chris.path.length - 1) {
                chris.pathIndex++;
                console.log('Chris moved');
                console.log(chris.getLocation());
            }
            // finish timer state and UI after move
            this.finishChrisTimer();
            this.handleAI();
        }, 8000);
    },

    cancelChrisTimer() { //manual timer cancel
        if (!this.state.chrisTimerActive) return; //don't need to cancel if no timer
        clearTimeout(this.state.chrisTimerId);
        this.finishChrisTimer()
    },

    finishChrisTimer() { //clear timer
        this.state.chrisTimerActive = false;
        this.state.chrisTimerId = null; 
        //hide video
        const v = document.getElementById('chris-video');
        if (v) { v.pause(); v.currentTime = 0; v.style.display = 'none'; } //reset video
        console.log("end of timer")
    },

    handlePower() {
        if (this.state.gameOver) return; //gameOver == true

        this.state.usage = 1; 
        if (!this.state.doorOpen) this.state.usage++; //if not doorOpen == true (doorOpen == false)
        if (this.state.blindsOn) this.state.usage++; //blindsOn == true
        if (this.state.isCameraOpen) this.state.usage++; //isCameraOpen == true

        const drain = baseDrainRate + (this.state.usage * usagePenalty); //you can probably increase this (baseDrainRate and usagePenalty) too
        this.state.power -= drain; 

        if (this.state.power <= 0) {
            this.state.power = 0;
            this.triggerPowerOutage();
        }//power out when power == 0, self explanatory
    },

    handleTime() {
        if (this.state.gameOver) return; //don't add to timeElapsed if gameOver == true
        this.state.timeElapsed++;
        if (Math.floor(this.state.timeElapsed / 20) >= 6) {
            this.triggerGameOver("Good job! You made it to 6am.", "alive")
        };
    },

    handleAI() {
        if (this.state.gameOver) return; //no AI if gameOver == true

        this.enemies.forEach(enemy => {
            const hasMoved = enemy.attemptMove(); //we may use later ig, a check if the enemy moved and command for them to move
            
            if (enemy.getLocation() == 'classroom') {

                if (this.state.doorOpen) { //if ya door open
                    this.jumpscare(enemy.name, `${enemy.name} got you!`); //calls triggerGameOver
                } 

                else if (enemy.name == "Welly") {
                    enemy.pathIndex -- //boy get back to the door
                    console.log("boy get back to the door")
                } 

                else {
                    console.log(`${enemy.name} hit the door! Resetting.`); //successfully blocked, in real game the animatronic waits
                    enemy.reset(); 
                }
            }
        });
    },

    detectEnemies(room) {
        let totalenemies = 0
        var enemieslist = []
        this.enemies.forEach(enemy => { //in your current room, check for enemies with matching rooms; also may be a placeholder.
            if (enemy.getLocation() == room) {
                totalenemies += 1;
                enemieslist.push(`${enemy.name}and`);
            };
        });
        var str = enemieslist.join("");
        str = str.slice(0,-3)
        if (enemieslist.length > 0){
            document.getElementById('animatronic-status').innerText = `⚠️ DETECTED: ${str} ⚠️`;
        }
        return str
    },


    // Safely load the next queued level: stop timers, reset core state, update existing enemies (difficulty/path)
    // and add new ones. This prevents immediate threats after a win.
    loadNextLevel() {
        // Stop game activity and timers
        this.stopAllIntervals();
        this.cancelChrisTimer();

        // Reset everything!!! >:)
        document.querySelector("#win-screen").style.display = "none"; //hide win screen
        this.state.power = startPower;
        this.state.timeElapsed = 0;
        this.state.isCameraOpen = false;
        this.state.currentCamera = 'gym';
        this.state.doorOpen = true;
        this.state.blindsOn = false;
        this.state.gameOver = false;
        this.state.chrisTimerActive = false;
        this.state.chrisTimerId = null;

        // Update existing enemies if names match, otherwise add them fresh
        const next = this.queuedLevels.shift(); //removes first level in queue and return it
        if (!next) {
            console.log('No queued levels to load');
            return false;
        }
        next.forEach(cfg => {
            //takes new configs (queuedlevels)
            const name = cfg.name;
            const path = cfg.path;
            const difficulty = cfg.difficulty 

            //looks for already existing enemies
            const existing = this.enemies.find(e => e.name == name);
            if (existing) {
                //sets new path and difficulty
                existing.path = path.slice(); 
                existing.difficulty = difficulty;
                existing.reset(); // important! 
                console.log('Updated existing enemy for next level:', name);
            } else {
                this.enemies.push(new Animatronic(name, path.slice(), difficulty));
                console.log('Added new enemy for next level:', name);
            }
        });

        this.currentQueuedLevelIndex += 1;

        this.updateUI(); //restart both intervals
        this.startLoop(); 
        console.log('Loaded queued level #' + (this.currentQueuedLevelIndex + 2));
        return true;
    },


    toggleDoor() {
        if (this.state.power <= 0) return; //Can't do anything if power down
        if (this.state.isCameraOpen) return; //Can't toggle with camera
        this.state.doorOpen = !this.state.doorOpen; //a toggle
        this.updateUI(); //does not affect intervals
    },

    toggleBlinds() {
        if (this.state.power <= 0) return;
        if (this.state.isCameraOpen) return;
        this.state.blindsOn = !this.state.blindsOn;
        this.updateUI();
    },

    toggleCamera() {
        if (this.state.power <= 0) return;
        this.state.isCameraOpen = !this.state.isCameraOpen;
        if (this.state.isCameraOpen) {
            this.state.blindsOn = false; //turns blinds off if camera on
        } else {
            // If camera closed, ensure the CHRIS video is hidden and paused
            const v = document.getElementById('chris-video');
            if (v) { 
                v.pause(); 
                v.style.display = 'none'; 
            }
        }
        this.updateUI();
    },

    // Switch camera by direction: 'forward' or 'backward' (also accepts 'left'/'right')
    switchCamera(direction) {
        if (!this.state.isCameraOpen) return; // can't switch camera if camera off

        // Direction either +1 (forward/right) or -1 (backward/left)
        let delta = 0;
        if (direction == 'forward') delta = 1;
        else if (direction == 'backward') delta = -1;
        else return; // unknown direction

        const currentIndex = ROOM_IDS.indexOf(this.state.currentCamera); //string to index(int)
        const startIndex = currentIndex == -1 ? 0 : currentIndex; //true:false
        const nextIndex = (startIndex + delta + ROOM_IDS.length) % ROOM_IDS.length; //modulo will cycle through itself
        this.state.currentCamera = ROOM_IDS[nextIndex];
        console.log("camera changed: ", this.state.currentCamera)
        this.updateUI();
    },

    jumpscare(char, reason) {
        this.stopAllIntervals(); //1
        this.state.gameOver = true; 
        const charEl = document.getElementById('jumpscare'); 

        charEl.pause();
        charEl.currentTime = 0;
        charEl.style.display = 'block';
        charEl.style.zIndex = 10000;
        charEl.muted = false;

        //4. pauses video, resets video, makes video invisible, takes out eventlistener
        const cleanup = () => { 
            charEl.pause();
            charEl.currentTime = 0;
            charEl.style.display = 'none';
            charEl.removeEventListener('ended', onEnded);
        };

        //3. calls cleanup
        const onEnded = () => { cleanup(); this.triggerGameOver(reason, 'dead'); }; //5. gammeover triggered

        charEl.addEventListener('ended', onEnded); //2. event listener for when the video ends
        charEl.src = `jump${char}.mp4`;
        charEl.load();
        charEl.play();
    },


    triggerGameOver(reason, d_a) {
        this.stopAllIntervals();
        this.cancelChrisTimer();
        console.log('triggerGameOver called:', {reason, outcome: d_a });

        if (d_a == "dead"){
            document.getElementById('death-reason').innerText = reason; //tells u why u died
            document.getElementById('game-over-screen').style.display = "flex"; //opens death screen
            return;
        }

        if (d_a == "alive"){
            if (this.currentQueuedLevelIndex + 2 == 3){ 
                document.getElementById('win-msg').innerHTML = "<p>You quit. Good job.</p><p>Tell Cooper you liked his game</p>"
                document.getElementById('nextbutt').style.display = "none" //no next level
            } else{
            document.getElementById('win-msg').innerText = reason; //tells u why u won
            }
            // Ensure death screen is hidden and win screen is on top
            document.getElementById('game-over-screen').style.display = 'none';
            const winEl = document.getElementById('win-screen');
            winEl.style.display = 'flex';
            winEl.style.zIndex = '10000';
            return;
        }
    },

    triggerPowerOutage() {
        this.state.gameOver = true;
        this.state.doorOpen = true; 
        this.state.blindsOn = false;
        this.state.isCameraOpen = false; //no functionality

        document.getElementById("blackout").classList.add("active");
        this.updateUI();
        setTimeout(() => this.jumpscare("Welly", "Power ran out. Welly creates silence."), 5000); //game ends in 5 seconds 
    },

    stopAllIntervals() {
        this.intervals.forEach(clearInterval);
    },

    updateUI() { //uh oh
        document.getElementById('night').innerText = this.currentQueuedLevelIndex + 2
        document.getElementById('power-val').innerText = Math.floor(this.state.power);
        document.getElementById('usage-val').innerText = this.state.usage;
        document.getElementById('time-val').innerText = `${Math.floor(this.state.timeElapsed / 20)} AM`; // Fake time math
        const roominfo = document.querySelector("#room")

        //true : false for buttons
        const btnDoor = document.getElementById('btn-door');
        btnDoor.innerText = this.state.doorOpen ? "Door: UNLOCKED" : "Door: LOCKED"; //either UNLOCKED or LOCKED, based on output of doorOpen?
        btnDoor.className = this.state.doorOpen ? "" : "active-state";
       
        const btnBlinds = document.getElementById('btn-blinds');
        btnBlinds.innerText = this.state.blindsOn ? "blinds: UP" : "blinds: DOWN";
        btnBlinds.className = this.state.blindsOn ? "active-state" : "";

        const btnCam = document.getElementById('btn-camera');
        btnCam.className = this.state.isCameraOpen ? "active-state" : "";
        document.getElementById('cam-controls').style.display = this.state.isCameraOpen ? "flex" : "none";


        //CAMERA STUFF

        //Probably will replace later. These are in substitute of photos
        const mainView = document.getElementById('main-view');
        const viewInfo = document.getElementById('view-info');

        const roomNameTxt = document.getElementById('room-name');
        const roomDescTxt = document.getElementById('room-desc');
        const animatronicTxt = document.getElementById('animatronic-status');

        const mapEl = document.querySelector("#map");

        // Hide/pause the CHRIS video by default; we'll enable it explicitly when appropriate
        const chrisVideoEl = document.getElementById('chris-video');
        chrisVideoEl.style.display = 'none'; 

        mainView.className = ""; 
        animatronicTxt.innerText = "";

        if (this.state.isCameraOpen) { //check if camera open
            const currentRoomID = this.state.currentCamera; 
            const roomData = ROOMS[currentRoomID]; //basically just the name of the room

            mainView.classList.add(`view-cam-${currentRoomID}`); //changes style of view
            roominfo.innerText = currentRoomID //makes top-left text change acc. to room

            mapEl.style.opacity = "0.8"; //map up if camera up
            viewInfo.style.display = "block"; //needed if no image
            viewInfo.style.display = "none"; //since image available, no desc

            //also placeholders
            roomNameTxt.innerText = `CAM: ${roomData.name}`;
            roomDescTxt.innerText = roomData.description;
            const detection = this.detectEnemies(currentRoomID);
            console.log(detection)
 
            if (this.state.chrisTimerActive == true){
                if (currentRoomID == "elevator"){
                    mainView.style.backgroundImage = "url(elevatoropen.png)";
                }
                else if (currentRoomID == "hallway"){
                    // Play chrismoving while the 9s timer is active and user is viewing the hallway
                    chrisVideoEl.style.display = 'block';
                    chrisVideoEl.play();
                } 
                else {
                    console.log(currentRoomID)
                    // For other cameras, still show their static images while CHRIS timer is active
                    chrisVideoEl.style.display = 'none';
                    mainView.style.backgroundImage = `url(${currentRoomID}${detection}.png)`;
                }
            } else {
                mainView.style.backgroundImage = `url(${currentRoomID}${detection}.png)`;
            }
           

        } else { //camera closed, only looking at door
            mainView.classList.add('view-cam-door');
            viewInfo.style.display = "none";
            const detection = this.detectEnemies('door');
            console.log(detection)
            mapEl.style.opacity = "0.3"; //map dim
            roominfo.innerText = "classroom"

            if (!this.state.doorOpen) roomDescTxt.innerText += " [DOOR SECURED]"; //if not doorOpen == true, door is secured (functionality lives in handleAI)
            
            if (this.state.blindsOn) {
                console.log("blinds up")
                if (detection.length >= 1){
                    mainView.style.backgroundImage = `url(door${detection}.png)`; 
                    animatronicTxt.innerText = `${detection} is standing at the window!`; 
                    console.log("enemies")
                }
                else{ 
                    mainView.style.backgroundImage = "url(door.png)";
                    console.log("no enemies")
                }
            } else {
                mainView.style.backgroundImage = "";//I will change default to doorblind
            }
        }
    }
};

// Start the game (gameEngine.init()) called by html
