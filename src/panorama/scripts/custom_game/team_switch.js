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
    var playerIDS = Game.GetAllPlayerIDs();
    var radiantIDS = Game.GetPlayerIDsOnTeam(DOTATeam_t.DOTA_TEAM_GOODGUYS);
    var direIDS = Game.GetPlayerIDsOnTeam(DOTATeam_t.DOTA_TEAM_BADGUYS);

    var i = 0;

    for(var o = 0; o <= 5; o++){
        $("#ListDivider"+o).AddClass("hidden");
    }

    var enemyIDs = (Game.GetLocalPlayerInfo().player_team_id == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? direIDS : radiantIDS;
    for(var enemyID = enemyIDs[0]; enemyID <= enemyIDs[enemyIDs.length - 1]; enemyID++){
        var enemyInfo = Game.GetPlayerInfo(enemyID);

        $("#Player"+i+"_Name").text = enemyInfo.player_name;
        $("#Player"+i+"_Name").AddClass("connected");

        $("#Player"+i+"_Icon").heroname = Players.GetPlayerSelectedHero(enemyInfo.player_id);
        $("#Player"+i+"_Dis").AddClass("hidden");

        if(enemyInfo.player_connection_state == DOTAConnectionState_t.DOTA_CONNECTION_STATE_ABANDONED || enemyInfo.player_connection_state == DOTAConnectionState_t.DOTA_CONNECTION_STATE_DISCONNECTED){
            $("#Player"+i+"_Name").text = "DISCONNECTED";
            $("#Player"+i+"_Name").RemoveClass("connected");
            $("#Player"+i+"_Dis").RemoveClass("hidden");
        }

        $("#ListDivider"+i).RemoveClass("hidden");
        i++;
    }
}

function AttemptTeamSwitch(sentID) {

    var playerIDs = Game.GetAllPlayerIDs();
    var radiantIDS = Game.GetPlayerIDsOnTeam(DOTATeam_t.DOTA_TEAM_GOODGUYS);
    var direIDS = Game.GetPlayerIDsOnTeam(DOTATeam_t.DOTA_TEAM_BADGUYS);

    var enemyIDs = (Game.GetLocalPlayerInfo().player_team_id == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? direIDS : radiantIDS;
    var enemyID = enemyIDs[sentID];
    var enemyName = Game.GetPlayerInfo(enemyID).player_name;

    if($("#Player"+sentID+"_Name").text == "DISCONNECTED"){
        Game.GetLocalPlayerInfo().player_team_id = ((Game.GetLocalPlayerInfo().player_team_id == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? DOTATeam_t.DOTA_TEAM_BADGUYS : DOTATeam_t.DOTA_TEAM_GOODGUYS);
        GameEvents.SendCustomGameEventToServer( "attemptSwitchTeam", {swapID: Game.GetLocalPlayerInfo().player_id, newTeam: Game.GetLocalPlayerInfo().player_team_id});

        for(var otherID in playerIDs){
            if(Game.GetPlayerInfo(parseInt(otherID)).player_name == enemyName){
                Game.GetPlayerInfo(parseInt(otherID)).player_team_id = ((Players.GetTeam(parseInt(otherID)) == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? DOTATeam_t.DOTA_TEAM_BADGUYS : DOTATeam_t.DOTA_TEAM_GOODGUYS);
                GameEvents.SendCustomGameEventToServer( "attemptSwitchTeam", {swapID: parseInt(otherID), newTeam: Game.GetPlayerInfo(parseInt(otherID)).player_team_id });
            }
        }
    }
}
