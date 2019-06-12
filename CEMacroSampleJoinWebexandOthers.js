/**
 * @license
 * Copyright (c) 2019 Cisco and/or its affiliates.
 *
 * This software is licensed to you under the terms of the Cisco Sample
 * Code License, Version 1.1 (the "License"). You may obtain a copy of the
 * License at
 *
 *                https://developer.cisco.com/docs/licenses
 *
 * All use of the material herein must be in accordance with the terms of
 * the License. All rights not expressly granted by the License are
 * reserved. Unless required by applicable law or agreed to separately in
 * writing, software distributed under the License is distributed on an "AS
 * IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied.
 */
const xapi = require('xapi');

const KEYBOARD_TYPES = {
      NUMERIC     :   'Numeric'
    , SINGLELINE  :   'SingleLine'
    , PASSWORD    :   'Password'
    , PIN         :   'PIN'
}
const CALL_TYPES = {
      AUDIO     :   'Audio'
    , VIDEO     :   'Video'
}

const DIALPAD_ID = 'webexdialpad';
const DIALHOSTPIN_ID = 'webexhostpin';
const PHONECALLDIALPAD_ID = 'phonedialpad';
const VIDEOMUTE_ID = 'video_mute';

const INROOMCONTROL_WEBEXCONTROL_PANELID = 'webexdialler';
const INROOMCONTROL_HOMEBUTTON_PANELID = 'home_widget';
const INROOMCONTROL_CALLPHONENUMBER_PANELID = 'call_phone';


/* Use these to check that its a valid number (depending on what you want to allow users to call */
const REGEXP_URLDIALER = /([a-zA-Z0-9@_\-\.]+)/; /*  . Use this one if you want to allow URL dialling */
const REGEXP_NUMERICDIALER =  /^([0-9]{3,10})$/; /* Use this one if you want to limit calls to numeric only. In this example, require number to be between 3 and 10 digits. */

const DIALPREFIX_AUDIO_GATEWAY = '0';
// Make sure you use the correct Webex URL postfix that corresponds to your organization below
const DIALPOSTFIX_WEBEXURL = '@go.webex.com';

var webexnumbertodial = '';
var hostpin = '';
var isInWebexCall = 0;
var fixedStringToDial='';


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

xapi.event.on('CallDisconnect', (event) => {
	isInWebexCall = 0;
    });
    
function showDialPadPhoneCall(text, template){
        xapi.command("UserInterface Message TextInput Display", {
              InputType: KEYBOARD_TYPES.NUMERIC
            , Placeholder: template
            , Title: "Number to Dial"
            , Text: text
            , SubmitText: "Submit" 
            , FeedbackId: PHONECALLDIALPAD_ID
        }).catch((error) => { console.error(error); });
    }
    
function invokePhoneCallNumberInput()
    {
        xapi.command('UserInterface Message TextLine Display', { Text: 'Please provide the phone number you wish to dial on Touch Panel:', X:1, Y:1, Duration:10});
        showDialPadPhoneCall("Please enter the phone number (with area code):","XXXXXXXXXX" );
    }
    
function showDialPad(text){

         xapi.command("UserInterface Message TextInput Display", {
               InputType: KEYBOARD_TYPES.NUMERIC
             , Placeholder: '9 digit or full dial string'
             , Title: "Webex Call"
             , Text: text
             , SubmitText: "Next" 
             , FeedbackId: DIALPAD_ID
         }).catch((error) => { console.error(error); });
}

function toggleVideoMute(state)
{
    if (state=='Off')
    {
        xapi.command("Video Input MainVideo Mute");
        xapi.command("UserInterface Extensions Panel Update", {PanelID: VIDEOMUTE_ID, Name: 'Camera On'});        
    }
    else
    {
        xapi.command("Video Input MainVideo Unmute");
        xapi.command("UserInterface Extensions Panel Update", {PanelID: VIDEOMUTE_ID, Name: 'Camera Off'});

    }
}

/* This is the listener for the in-room control panel button that will trigger the dial panel to appear */
xapi.event.on('UserInterface Extensions Panel Clicked', (event) => {
    if(event.PanelId === INROOMCONTROL_WEBEXCONTROL_PANELID){
        xapi.command('UserInterface Message TextLine Display', { Text: 'Please provide the Webex conference ID on the Touch Panel:', X:1, Y:1, Duration:10});

         showDialPad("Enter the Webex 9-digit Meeting ID:" );
    }
    if(event.PanelId === INROOMCONTROL_HOMEBUTTON_PANELID){
        // close the panel?
   }
   if(event.PanelId === INROOMCONTROL_CALLPHONENUMBER_PANELID){
        invokePhoneCallNumberInput();
    }
   if(event.PanelId == VIDEOMUTE_ID){
        xapi.status.get('Video Input MainVideoMute').then(toggleVideoMute).catch(console.error);
    };
   

});



xapi.event.on('UserInterface Message TextInput Response', (event) => {
    switch(event.FeedbackId){
        case DIALPAD_ID:
            let regex =REGEXP_URLDIALER; // First check, is it a valid number to dial
            let match = regex.exec(event.Text);    
            if (match !== null) {
                let contains_at_regex = /@/;    
                let contains_at_in_dialstring = contains_at_regex.exec(event.Text);
                if (contains_at_in_dialstring !== null) {
                    webexnumbertodial = match[1];
                }
                else{
                    webexnumbertodial = match[1];
                    webexnumbertodial = webexnumbertodial + DIALPOSTFIX_WEBEXURL ; // Here we add the default hostname to the SIP number 
                }
                 sleep(200).then(() => { //this is a necessary trick to get it working with multiple touch panels to not mess up event-clears from other panels
  
                 xapi.command("UserInterface Message TextInput Display", {
                       InputType: KEYBOARD_TYPES.PIN
                     , Placeholder: "Hostpin (optional)" 
                     , Title: "Enter Host pin or leave blank"
                     , Text: 'Webex call number:' + webexnumbertodial
                     , SubmitText: "Dial" 
                     , FeedbackId: DIALHOSTPIN_ID
                 }).catch((error) => { console.error(error); });                
                 
            });

            }
            else{
                showDialPad("You typed in an invalid number. Please try again. Format is XXXXXXXXX" );
            }
            break;
        case PHONECALLDIALPAD_ID:
                // just dial a phone number
                console.log("Dialing a phone number. Entered: ",event.Text);
                fixedStringToDial=event.Text;
                // if 10 digits, assume North America dialing plan and prefix with +1, otherwise just let them dial whatever they entered
                if (fixedStringToDial.length==10) 
                {
                    console.log('NA dial plan, fixing string...');
                    fixedStringToDial='+1'+fixedStringToDial;
                }
                console.log("Actual number to dial: ",fixedStringToDial);
                xapi.command("dial", {Number: fixedStringToDial});
                break;
        case DIALHOSTPIN_ID:
            hostpin = event.Text;
            xapi.command("dial", {Number: webexnumbertodial}).catch((error) => { console.error(error); });
            break;
    }
});



xapi.status.on('Call RemoteNumber', (remoteNumber) => {
	if(remoteNumber.includes('webex.com')){
	    isInWebexCall = 1;
	    sleep(5000).then(() => {
		    if(isInWebexCall){ // need to check again in case call has dropped within the last 5 seconds
                if(hostpin.length>0){
                  xapi.command("Call DTMFSend", {DTMFString: hostpin});  
                    if(!hostpin.includes('#')){
                        xapi.command("Call DTMFSend", {DTMFString: '#'});
                    }
                } 
                else{
                    xapi.command("Call DTMFSend", {DTMFString: '#'});
                }
		    }		    
		});
	}
    });