"use strict";

function ShowTeamSwitch() {

}

function CloseTeamSwitch() {

}

function AttempTeamSwitch() {
    //REPLACE WITH ASH IMPLEMENTATION
    GameEvents.SendCustomGameEventToServer( "team_switch", {} );
}
