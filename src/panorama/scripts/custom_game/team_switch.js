"use strict";

var active = false;

function TeamSwitchButton (){
    if(!active) {
        ShowTeamSwitch();
    } else {
        CloseTeamSwitch();
    }
}
function ShowTeamSwitch() {

    SetTeamInfo();
    CheckConnectionStates();

    active = true;
    $("#TeamSwitch_Panel").RemoveClass("hidden");
}
function CloseTeamSwitch() {
    active = false;
    $("#TeamSwitch_Panel").AddClass("hidden");
}

function SetTeamInfo() {
    var enemyIDS = Game.GetPlayerIDsOnTeam((Game.GetLocalPlayerInfo().player_team_id == 0) ? 1 : 0);
    for(var enemyID in enemyIDS){
        var enemyInfo = Game.GetPlayerInfo(parseInt(enemyID));
        $("#Player"+enemyInfo.player_id+"_Name").text = enemyInfo.player_name;
        $("#Player"+enemyInfo.player_id+"_Icon").heroname = enemyInfo.player_selected_hero.heroname;
    }
}

function CheckConnectionStates() {

    var enemyIDS = Game.GetPlayerIDsOnTeam((Game.GetLocalPlayerInfo().player_team_id == 0) ? 1 : 0);
    for(var enemyID in enemyIDS){
        var enemyInfo = Game.GetPlayerInfo(parseInt(enemyID));

        if(playerInfo.player_connection_state == DOTAConnectionState_t.DOTA_CONNECTION_STATE_DISCONNECTED ||
        playerInfo.player_connection_state == DOTAConnectionState_t.DOTA_CONNECTION_STATE_ABANDONED){
            $("#Player"+enemyInfo.player_id+"_Name").text = "DISCONNECTED";
            $("#Player"+enemyInfo.player_id+"_Icon").heroname = "";
        }
    }
}

function AttemptTeamSwitch(playerID) {
    if($("#Player"+num+"_Name").text == "DISCONNECTED"){
        $.Ingame:balancePlayer(playerID, ((Players.GetTeam(playerID) == 0) ? 1 : 0));
        $.Ingame:balancePlayer(Game.GetLocalPlayerInfo().player_id, ((Game.GetLocalPlayerInfo().player_team_id == 0) ? 1 : 0));
    }
}
