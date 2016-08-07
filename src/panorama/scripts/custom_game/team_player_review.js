"use strict";

// Stub
//var setSelectedDropAbility = function(){};
var setSelectedHelperHero = function(){};
var makeSkillSelectable = function(){};

// Should we make everything small?
var shouldMakeSmall = false;

// Have we already loaded our hero model?
var loadedHeroModel = false;

// Our player's ID
var ourPlayerID = -1;

// When player details are changed
function onPlayerDetailsChanged() {
    var playerID = $.GetContextPanel().GetAttributeInt('playerID', -1);
    var playerInfo = Game.GetPlayerInfo(playerID);
    if (!playerInfo) return;

    if(playerInfo.player_connection_state == 1) {
        // Bot player
        $("#reviewPhasePlayerAvatar").steamid = 76561197988355984;
        $("#reviewPhasePlayerAvatarBig").steamid = 76561197988355984;
    } else {
        $("#reviewPhasePlayerAvatar").steamid = playerInfo.player_steamid;
        $("#reviewPhasePlayerAvatarBig").steamid = playerInfo.player_steamid;
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

// When review phase starts
var failCount = 0;
function onReviewPhaseStart() {
    var ourHeroName = Game.shared.selectedHeroes[ourPlayerID];

    if(!loadedHeroModel) {
        if(ourHeroName == null) {
            // Stop this from being called too many times
            if(++failCount > 3) return;

            // Run it again after a short delay
            $.Schedule(1, onReviewPhaseStart);
        } else {
            // We have now loaded our hero icon
            loadedHeroModel = true;

            // Show the actual hero icon
            var mainPanel = $.GetContextPanel();
            mainPanel.SetHasClass('no_hero_selected', false);

            // Put the hero image in place
            var con = $('#reviewPhaseHeroImageContainer');

            var size = 256;
            if(shouldMakeSmall) {
                size = 84;
            }

            var heroImage = $.CreatePanel('Panel', con, 'reviewPhaseHeroImageLoader');
            heroImage.BLoadLayoutFromString('<root><Panel><DOTAScenePanel style="width: ' + size + 'px; height: ' + size + 'px; opacity-mask: url(\'s2r://panorama/images/masks/softedge_box_png.vtex\');" unit="' + ourHeroName + '"/></Panel></root>', false, false);
        }
    }
}

// Do the highlight
var selectedSlotID = -1;
function doSlotHighlight() {
	for(var i=1; i<=6; ++i) {
		var slot = $('#playerSkill' + i);

		if(selectedSlotID == -1) {
			slot.SetHasClass('lodSelectedDrop', false);
			slot.SetHasClass('lodSelected', false);
		} else {
			slot.SetHasClass('lodSelectedDrop', selectedSlotID != i);
			slot.SetHasClass('lodSelected', selectedSlotID == i);
		}
	}
}

// Implement slot swapping
function makeSwapable(slotID, abcon) {
	abcon.SetPanelEvent('onactivate', function() {
        if(selectedSlotID == -1) {
        	selectedSlotID = slotID;
        } else {
        	if(selectedSlotID != slotID) {
        		// Do the swap slot
        		swapSlots(selectedSlotID, slotID);
        	}

        	// None selected anymore
        	selectedSlotID = -1;
        }

        doSlotHighlight();
    });

    // Dragging
    abcon.SetDraggable(true);

    $.RegisterEventHandler('DragEnter', abcon, function(panelID, draggedPanel) {
        abcon.AddClass('potential_drop_target');
        selectedSlotID = slotID;
    });

    $.RegisterEventHandler('DragLeave', abcon, function(panelID, draggedPanel) {
        $.Schedule(0.1, function() {
            abcon.RemoveClass('potential_drop_target');

            if(draggedPanel.deleted == null && selectedSlotID == slotID) {
                selectedSlotID = -1
            }
        });
    });

    $.RegisterEventHandler('DragStart', abcon, function(panelID, dragCallbacks) {
        var abName = abcon.GetAttributeString('abilityname', '');
        if(abName == null || abName.length <= 0) return false;

        // Create a temp image to drag around
        var displayPanel = $.CreatePanel('DOTAAbilityImage', $.GetContextPanel(), 'dragImage');
        displayPanel.abilityname = abName;
        dragCallbacks.displayPanel = displayPanel;
        dragCallbacks.offsetX = 0;
        dragCallbacks.offsetY = 0;
        displayPanel.SetAttributeString('abilityname', abName);

        // Hide skill info
        $.DispatchEvent('DOTAHideAbilityTooltip');

        selectedSlotID = slotID;
        doSlotHighlight();
    });

    $.RegisterEventHandler('DragEnd', abcon, function(panelId, draggedPanel) {
        // Delete the draggable panel
        draggedPanel.deleted = true;
        draggedPanel.DeleteAsync(0.0);

        if(selectedSlotID != -1) {
        	if(selectedSlotID != slotID) {
        		// Do the swap slot
        		Game.shared.swapSlots(selectedSlotID, slotID);
        	}

        	// None selected anymore
        	selectedSlotID = -1;
        }

        doSlotHighlight();
    });
}

function setShouldBeSmall(shouldMakeSmallTemp) {
    // Store the temp
    shouldMakeSmall = shouldMakeSmallTemp;

    // Add the class
    $.GetContextPanel().SetHasClass('tooManyPlayers', shouldMakeSmall);
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

// When a player's ready state changes
function onReadyChanged(data) {
    var newState = data[ourPlayerID];
    $.GetContextPanel().SetHasClass("lodPlayerIsReady", newState == 1);
}

// When the current phase changes
function onPhaseChanged(data) {
    // Is it review phase time?
    if(Game.shared.currentPhase == Game.shared.PHASE_REVIEW) {
        // Review phase has started
        onReviewPhaseStart();
    }
}

// Sets the playerID of this panel
function setPlayerID(playerID) {
    // Store it
    ourPlayerID = playerID;

    // Run all events
    if(Game.shared.currentPhase == Game.shared.PHASE_REVIEW) {
        // Review phase has started
        updateBuildData();
        updateSelectedAttribute();
        onReviewPhaseStart();
        onMaxSlotsChanged();
    }
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

        // Make it swappable
        makeSwapable(i, con);
    }

    // Register for events
    Game.shared.events.on('buildChanged', onSelectedBuildChanged);
    Game.shared.events.on('maxSlotsChanged', onMaxSlotsChanged);
    Game.shared.events.on('attrChanged', onAttrChanged);
    Game.shared.events.on('readyChanged', onReadyChanged);
    Game.shared.events.on('phaseChanged', onPhaseChanged);

    // Define exports
    mainPanel.setShouldBeSmall = setShouldBeSmall;
    mainPanel.setPlayerID = setPlayerID;
})();
