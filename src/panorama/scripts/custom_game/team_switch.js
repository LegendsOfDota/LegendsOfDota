"use strict";

var customTeamAssignments = {};
var active = false;

GameEvents.Subscribe( "player_team", GetTeamInfo);
GameEvents.Subscribe( "player_reconnected", GetTeamInfo);

function TeamSwitchButton (){
    if(!active) {
        ShowTeamSwitch();
    } else {
        CloseTeamSwitch();
    }
}
function ShowTeamSwitch() {
    GetTeamInfo();
    active = true;
    $("#TeamSwitch_Panel").RemoveClass("hidden");
}
function CloseTeamSwitch() {
    active = false;
    $("#TeamSwitch_Panel").AddClass("hidden");
}

function RecieveCustomTeamInfo( team_info )
{
	customTeamAssignments = team_info;
    SetTeamInfo();
}
GameEvents.Subscribe( "send_custom_team_info", RecieveCustomTeamInfo);

function GetTeamInfo() {
    GameEvents.SendCustomGameEventToServer( "ask_custom_team_info", {playerID: parseInt(Game.GetLocalPlayerInfo().player_id)} );
}

function SetTeamInfo() {

    var playerIDS = Game.GetAllPlayerIDs();
    var enemyTeam = (customTeamAssignments[Game.GetLocalPlayerInfo().player_id] == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? DOTATeam_t.DOTA_TEAM_BADGUYS : DOTATeam_t.DOTA_TEAM_GOODGUYS;

    var i = 0;
    var teamDifference = 0;

    for(var o = 0; o <= 5; o++){
        $("#ListDivider"+o).AddClass("hidden");
    }

    for(var enemyID = playerIDS[0]; enemyID <= playerIDS[playerIDS.length-1]; enemyID++){
        if(customTeamAssignments[enemyID] == enemyTeam){
            var enemyInfo = Game.GetPlayerInfo(enemyID);

            $("#Player"+i+"_Name").text = enemyInfo.player_name;
            $("#Player"+i+"_Name").AddClass("connected");

            $("#Player"+i+"_Icon").heroname = Players.GetPlayerSelectedHero(enemyInfo.player_id);
            $("#Player"+i+"_Dis").AddClass("hidden");

            if(enemyInfo.player_connection_state == DOTAConnectionState_t.DOTA_CONNECTION_STATE_ABANDONED || enemyInfo.player_connection_state == DOTAConnectionState_t.DOTA_CONNECTION_STATE_DISCONNECTED){
                $("#Player"+i+"_Name").text = "DISCONNECTED";
                $("#Player"+i+"_Name").RemoveClass("connected");
                $("#Player"+i+"_Dis").RemoveClass("hidden");
            }else{
                teamDifference--;
            }

            $("#ListDivider"+i).RemoveClass("hidden");
            i++;
        }else if(Game.GetPlayerInfo(enemyID).player_connection_state != DOTAConnectionState_t.DOTA_CONNECTION_STATE_ABANDONED && Game.GetPlayerInfo(enemyID).player_connection_state != DOTAConnectionState_t.DOTA_CONNECTION_STATE_DISCONNECTED){
            teamDifference++;
        }
    }

    if(teamDifference >= 2 && active == false){
        $("#BalanceWarning").RemoveClass("hidden");
    }else{
        $("#BalanceWarning").AddClass("hidden");
    }
}

function AttemptTeamSwitch(sentID) {

    var playerIDs = Game.GetAllPlayerIDs();
    var enemyID;
    var k = 0;

    if($("#Player"+sentID+"_Name").text == "DISCONNECTED"){
        for(var playerID in playerIDs){
            if(customTeamAssignments[playerID] != customTeamAssignments[Game.GetLocalPlayerID()]){
                if(k == sentID){
                    enemyID = playerID;
                    break;
                }
                k++;
            }
        }

        var swapTo = (customTeamAssignments[Game.GetLocalPlayerID()] == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? DOTATeam_t.DOTA_TEAM_BADGUYS : DOTATeam_t.DOTA_TEAM_GOODGUYS;
        var enemySwapTo = (customTeamAssignments[enemyID] == DOTATeam_t.DOTA_TEAM_GOODGUYS) ? DOTATeam_t.DOTA_TEAM_BADGUYS : DOTATeam_t.DOTA_TEAM_GOODGUYS;

        GameEvents.SendCustomGameEventToServer( "attemptSwitchTeam", {swapID: Game.GetLocalPlayerInfo().player_id, newTeam: parseInt(swapTo)});
        GameEvents.SendCustomGameEventToServer( "attemptSwitchTeam", {swapID: parseInt(enemyID), newTeam: parseInt(enemySwapTo)});
    }
}
