let username = '';
let connectedUser = '';
let loginPage = document.querySelector('#login-page'),
    usernameInput = document.querySelector('#username'),
    loginButton = document.querySelector('#login'),
    callPage = document.querySelector('#call-page'),
    theirUsernameInput = document.querySelector('#their-username'),
    callButton = document.querySelector('#call'),
    hangUpButton = document.querySelector('#hang-up');
let yourVideo = document.querySelector('#yours'),
    theirVideo = document.querySelector('#theirs'),
    yourConnection, stream;
let connection = new WebSocket('ws://localhost:7070');
let configuration = {
    //'iceServers' : [{ 'url' : 'stun:stun.l.google.com:19302'}]
    //'iceServers' : [{ 'url' : 'stun:1.234.23.6:3478'}]
    'iceServers': []
};
const videoSelect = document.querySelector('#video-source');
const audioInputSelect = document.querySelector('#audio-source');
const selectors = [audioInputSelect, videoSelect];

callPage.style.display = 'none';

function gotDevices(deviceInfos) {
    // Handles being called several times to update labels. Preserve values.
    const values = selectors.map(select => select.value);
    selectors.forEach(select => {
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
    });
    for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        const option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
            audioInputSelect.appendChild(option);
//        } else if (deviceInfo.kind === 'audiooutput') {
//            option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
//            audioOutputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {
            option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
            videoSelect.appendChild(option);
        } else {
            console.log('Some other kind of source/device: ', deviceInfo);
        }
    }
    selectors.forEach((select, selectorIndex) => {
        if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
            select.value = values[selectorIndex];
        }
    });
}


function handleError(error) {
    console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

loginButton.addEventListener('click', function (e) {
    username = usernameInput.value;
    if (username.length > 0) {
        send({
            type: 'login',
            username: username,
        });
    }
});

connection.onopen = function () {
    console.log('Connected');
}
connection.onmessage = function (message) {
    console.log('Got message', message.data);
    var data = JSON.parse(message.data);
    switch (data.type) {
        case 'login':
            onLogin(data.success);
            break;
        case "offer":
            onOffer(data.offer, data.username);
            break;
        case "answer":
            onAnswer(data.answer);
            break;
        case "candidate":
            onCandidate(data.candidate);
            break;
        case "leave":
            onLeave();
            break;
        default:
            break;
    }
}
connection.onerror = function (e) {
    console.log('Got error', err);
}

function send(message) {
    if (connectedUser) {
        message.username = connectedUser;
    }
    if (connection.readyState === 1) {
        connection.send(JSON.stringify(message));
    } else {
        connection = new WebSocket('wss://localhost:7070');
    }
}

function onLogin(success) {
    if (success === false) {
        alert('Login unsuccessful, please try a different name.');
    } else {
        loginPage.style.display = 'none';
        callPage.style.display = 'block';
        startConnection();
    }
}

callButton.addEventListener('click', function() {
    var theirUsername = theirUsernameInput.value;

    if (theirUsername.length > 0) {
        startPeerConnection(theirUsername);
    }
});

hangUpButton.addEventListener("click", function () {
    send({
        type: "leave"
    });
    onLeave();
});

function onOffer(offer, name) {
    connectedUser = name;
    yourConnection.setRemoteDescription(new RTCSessionDescription(offer));
    yourConnection.createAnswer(function (answer) {
        yourConnection.setLocalDescription(answer);
        send({
            type: "answer",
            username: connectedUser,
            answer: answer
        });
    }, function (error) {
        alert("An error has occurred");
    });
}
function onAnswer(answer) {
    yourConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function onCandidate(candidate) {
    yourConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function onLeave() {
    connectedUser = null;
    theirVideo.src = null;
    yourConnection.close();
    yourConnection.onicecandidate = null;
    yourConnection.onaddstream = null;
    setupPeerConnection(stream);
}

function hasUserMedia() {
    navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;
    return !!navigator.getUserMedia;
}

function hasRTCPeerConnection() {
    window.RTCPeerConnection = window.RTCPeerConnection ||
        window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    window.RTCSessionDescription = window.RTCSessionDescription ||
        window.webkitRTCSessionDescription ||
        window.mozRTCSessionDescription;
    window.RTCIceCandidate = window.RTCIceCandidate ||
        window.webkitRTCIceCandidate || window.mozRTCIceCandidate;
    return !!window.RTCPeerConnection;
}

function startConnection() {
    var ua = navigator.userAgent.toLowerCase(); 
    if (ua.indexOf('safari') != -1) { 
        if (ua.indexOf('chrome') <= -1) {
            navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
            navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false,
            }).then(function(myStream) {
                    stream = myStream;
                    yourVideo.srcObject = myStream;
                    setupPeerConnection(stream);
            }).catch(function (err) {
                console.log(err);
            });
        } else {
            let enableVideo;
            let enableAudio;
            let videoSource = videoSelect.value;
            let audioSource = audioInputSelect.value;

            if (username == 'admin') {
                enableVideo = false;
                enableAudio = false;
                yourVideo.style.display = 'none';
                setupPeerConnection2();
            } else {
                navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
                enableVideo = {
                    deviceId: videoSource ? { exact: videoSource } : undefined
                }
                enableAudio= {deviceId: audioSource ? {exact: audioSource} : undefined}


                navigator.mediaDevices.getUserMedia({
                    video: enableVideo,
                    audio: enableAudio,
                }).then(function(myStream) {
                    stream = myStream;
                    yourVideo.srcObject = myStream;
                    setupPeerConnection(stream);
                }).catch(function (err) {
                    setupPeerConnection2();
                    console.log(err);
                });
            }
            //console.log('enableVideo', enableVideo);
        }
    }
}

videoSelect.onchange = startConnection;
audioInputSelect.onchange = startConnection;

function setupPeerConnection(stream) {
    yourConnection = new RTCPeerConnection(configuration);

    yourConnection.addStream(stream);
    yourConnection.onaddstream = function(e) {
        theirVideo.srcObject = e.stream;
    };

    yourConnection.onicecandidate = function(e) {
        if (e.candidate) {
            send({
                type: "candidate",
                candidate: e.candidate,
            });
        }
    };
}

function setupPeerConnection2() {
    yourConnection = new RTCPeerConnection(configuration);

    yourConnection.onaddstream = function(e) {
    	console.log('DEBUGXXXX:', e.stream)
        theirVideo.srcObject = e.stream;
    };

    yourConnection.onicecandidate = function(e) {
        if (e.candidate) {
            send({
                type: "candidate",
                candidate: e.candidate,
            });
        }
    };
}

function startPeerConnection(user) {
    connectedUser = user;
    // Begin the offer
    yourConnection.createOffer({
        offerToReceiveAudio: true, offerToReceiveVideo: true 
    }).then(function (offer) {
        send({
            type: "offer",
            username: connectedUser,
            offer: offer
        });
        yourConnection.setLocalDescription(offer);
    }).catch(function (error) {
        alert("An error has occurred.");
    });
};
