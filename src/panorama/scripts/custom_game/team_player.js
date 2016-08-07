"use strict";

// Our player's ID
var ourPlayerID = -1;

// When player details are changed
function onPlayerDetailsChanged() {
    var playerID = $.GetContextPanel().GetAttributeInt('playerID', -1);
    var playerInfo = Game.GetPlayerInfo(playerID);
    if (!playerInfo) return;

    if(playerInfo.player_connection_state == 1) {
    	// Bot player
    	$("#playerAvatar").steamid = 76561197988355984;
    } else {
    	// Set Avatar
    	$("#playerAvatar").steamid = playerInfo.player_steamid;
    }

    // Is it the real Ash47?
    var playerName = playerInfo.player_name;
    if(playerInfo.player_steamid == 76561197988355984) {
        $("#playerName").AddClass('theRealAsh47');
    } else {
        // No one can steal my name
        playerName = playerName.replace(/ash47/ig, 'some noob');
        playerName = playerName.replace(/47/ig, '48');
        $("#playerName").RemoveClass('theRealAsh47');
    }

    // Set Name
    $("#playerName").text = playerName;

    $.GetContextPanel().SetHasClass("player_is_local", playerInfo.player_is_local);
    $.GetContextPanel().SetHasClass("player_has_host_privileges", playerInfo.player_has_host_privileges);
}

// When we get hero data
function OnGetHeroData(heroName) {
	// Show the actual hero icon
	var mainPanel = $.GetContextPanel();
	mainPanel.SetHasClass('no_hero_selected', false);

	// Put the hero image in place
	var heroCon = $('#playerHeroImage');
	heroCon.heroname = heroName;
	heroCon.SetAttributeString('heroName', heroName);
}

// When hero data is updated
function onSelectedHeroChanged(data) {
    var playerID = data.playerID;

    if(playerID == ourPlayerID) {
        updatedSelectedHero();
    }
}

// Updates the hero in our slot
function updatedSelectedHero() {
    var heroName = Game.shared.selectedHeroes[ourPlayerID];

    // Show the actual hero icon
    var mainPanel = $.GetContextPanel();

    if(heroName != null) {
        // Show the actual hero icon
        mainPanel.SetHasClass('no_hero_selected', false);

        // Put the hero image in place
        var heroCon = $('#playerHeroImage');
        heroCon.heroname = heroName;
        heroCon.SetAttributeString('heroName', heroName);
    } else {
        // Show the "no hero" icon
        mainPanel.SetHasClass('no_hero_selected', true);
    }
}

// When we get the slot count
function onMaxSlotsChanged() {
    // Grab max slots
    var maxSlots = Game.shared.optionValueList['lodOptionCommonMaxSlots'];

    // Toggle stuff on / off
	$('#playerSkill1').visible = maxSlots >= 1;
	$('#playerSkill2').visible = maxSlots >= 2;
	$('#playerSkill3').visible = maxSlots >= 3;
	$('#playerSkill4').visible = maxSlots >= 4;
	$('#playerSkill5').visible = maxSlots >= 5;
	$('#playerSkill6').visible = maxSlots >= 6;
}

// When a player's selected attribute changes
function onAttrChanged(data) {
    var playerID = data.playerID;
    if(ourPlayerID == playerID) {
        updateSelectedAttribute();
    }
}

function updateSelectedAttribute() {
    var newAttr = Game.shared.selectedAttr[ourPlayerID];
    if(newAttr == null) return;

    var attr = 'file://{images}/primary_attribute_icons/primary_attribute_icon_strength.psd';
    if(newAttr == 'agi') {
        attr = 'file://{images}/primary_attribute_icons/primary_attribute_icon_agility.psd';
    } else if(newAttr == 'int') {
        attr = 'file://{images}/primary_attribute_icons/primary_attribute_icon_intelligence.psd';
    }

    // Grab con
    var con = $('#playerAttribute');

    // Set it
    con.SetImage(attr);

    // Show it
    con.SetHasClass('doNotShow', false);
}

function onSelectedBuildChanged(data) {
    var playerID = data.playerID;

    if(playerID == ourPlayerID) {
        updateBuildData();
    }
}

// When we get build data
function updateBuildData() {
    var build = Game.shared.selectedSkills[ourPlayerID];
    if(build == null) return;

	for(var i=1; i<=Game.shared.maxSlots; ++i) {
		var con = $('#playerSkill' + i);

		if(build[i]) {
			con.abilityname = build[i];
			con.SetAttributeString('abilityname', build[i]);
		} else {
			con.abilityname = 'life_stealer_empty_1';
			con.SetAttributeString('abilityname', 'life_stealer_empty_1');
		}
	}
}

function onReadyChanged(data) {
    var newState = data[ourPlayerID];
    $.GetContextPanel().SetHasClass("lodPlayerIsReady", newState == 1);
}

// Sets the playerID of this panel
function setPlayerID(playerID) {
    // Store it
    ourPlayerID = playerID;

    // Run all events
    updatedSelectedHero();
    updateBuildData();
    updateSelectedAttribute();
    onMaxSlotsChanged();
}

// When this panel loads
(function()
{
	// Grab the main panel
	var mainPanel = $.GetContextPanel();

    onPlayerDetailsChanged();
    $.RegisterForUnhandledEvent('DOTAGame_PlayerDetailsChanged', onPlayerDetailsChanged);

    // Hook skill info
    for(var i=1; i<=Game.shared.maxSlots; ++i) {
        var con = $('#playerSkill' + i);
        con.SetAttributeString('abilityname', '');
        Game.shared.hookSkillInfo(con);

        // Make it draggable
        Game.shared.makeSkillSelectable(con);
    }

    // Hook the hero icon
    Game.shared.makeHeroSelectable($('#playerHeroImage'));

    // Register for events
    Game.shared.events.on('heroChanged', onSelectedHeroChanged);
    Game.shared.events.on('buildChanged', onSelectedBuildChanged);
    Game.shared.events.on('maxSlotsChanged', onMaxSlotsChanged);
    Game.shared.events.on('attrChanged', onAttrChanged);
    Game.shared.events.on('readyChanged', onReadyChanged);

    // Define exports
    mainPanel.setPlayerID = setPlayerID;
})();
