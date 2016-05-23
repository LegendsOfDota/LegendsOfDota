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

    active = true;
    $("#TeamSwitch_Panel").RemoveClass("hidden");
}
function CloseTeamSwitch() {
    active = false;
    $("#TeamSwitch_Panel").AddClass("hidden");
}

function SetTeamInfo() {
    $.Msg(Game.GetLocalPlayerInfo().player_team_id);
    var enemyIDS = Game.GetPlayerIDsOnTeam((Game.GetLocalPlayerInfo().player_team_id == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? DOTATeam_t.DOTA_TEAM_BADGUYS : DOTATeam_t.DOTA_TEAM_GOODGUYS);
    for(var enemyID in enemyIDS){
        var enemyInfo = Game.GetPlayerInfo(parseInt(enemyID));
        var heroIndex = Players.GetPlayerHeroEntityIndex(parseInt(enemyID))

        $("#Player"+enemyInfo.player_id+"_Name").text = enemyInfo.player_name;
        $("#Player"+enemyInfo.player_id+"_Icon").heroname = Entities.GetUnitName(parseInt(heroIndex));

        if(enemyInfo.player_connection_state == DOTAConnectionState_t.DOTA_CONNECTION_STATE_DISCONNECTED ||
        enemyInfo.player_connection_state == DOTAConnectionState_t.DOTA_CONNECTION_STATE_ABANDONED){
            $("#Player"+enemyInfo.player_id+"_Name").text = "DISCONNECTED";
            $("#Player"+enemyInfo.player_id+"_Icon").heroname = "";
        }
    }
}

function AttemptTeamSwitch(playerID) {
    if($("#Player"+num+"_Name").text == "DISCONNECTED"){
        GameEvents.SendCustomGameEventToServer( "balancePlayer", playerID, ((Players.GetTeam(playerID) == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? DOTATeam_t.DOTA_TEAM_BADGUYS : DOTATeam_t.DOTA_TEAM_GOODGUYS));
        GameEvents.SendCustomGameEventToServer( "balancePlayer", Game.GetLocalPlayerInfo().player_id, ((Game.GetLocalPlayerInfo().player_team_id == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? DOTATeam_t.DOTA_TEAM_BADGUYS : DOTATeam_t.DOTA_TEAM_GOODGUYS));
    }
}
