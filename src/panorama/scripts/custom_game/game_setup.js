"use strict";

// Shared stuff
var allOptions = Game.shared.allOptions;

// Used to make data transfer smoother
var dataHooks = {};

// Hide enemy picks?
var hideEnemyPicks = false;

// The current phase we are in
var currentPhase = Game.shared.PHASE_LOADING;
var selectedPhase = Game.shared.PHASE_OPTION_SELECTION;
var endOfTimer = -1;
var freezeTimer = -1;
var lastTimerShow = -1;
var allowCustomSettings = false;

// List of all player team panels
//var allPlayerPanels = [];
var activeUnassignedPanels = {};
var activePlayerPanels = {};
var activeReviewPanels = {};

// List of option links
var allOptionLinks = {};

// Prevent double option sending
var lastOptionValues = {};

// Map of optionName -> callback for value change
var optionFieldMap = {};

// Keeping track of bans
var currentHeroBans = 0;
var currentAbilityBans = 0;

// We have not picked a hero
var pickedAHero = false;

// Waiting for preache
var waitingForPrecache = true;

// Are we a premium player?
var isPremiumPlayer = false;

// The picking phase panel
var pickingPhasePanel;

// Focuses on nothing
Game.shared.focusNothing = function() {
    $('#mainSelectionRoot').SetFocus();
}

// Hero data has changed
function OnHeroDataChanged(table_name, key, data) {
    Game.shared.heroData[key] = data;

    for(var i=1; i<=16; ++i) {
        if(data['Ability' + i] != null) {
            Game.shared.abilityHeroOwner[data['Ability' + i]] = key;
        }
    }

    // Do the schedule
    if(dataHooks.OnHeroDataChanged == null) dataHooks.OnHeroDataChanged = 0;
    var myHookNumber = ++dataHooks.OnHeroDataChanged;
    $.Schedule(1, function() {
        if(dataHooks.OnHeroDataChanged == myHookNumber) {
            pickingPhasePanel.buildHeroList();
        }
    });
}

// Flag data has changed
function OnflagDataChanged(table_name, key, data) {
    // Flag data
    if(data.isFlagData) {
        Game.shared.flagDataInverse[key] = data.flagData;

        // Do the schedule
        if(dataHooks.OnFlagDataChanged == null) dataHooks.OnFlagDataChanged = 0;
        var myHookNumber = ++dataHooks.OnFlagDataChanged;
        $.Schedule(1, function() {
            if(dataHooks.OnFlagDataChanged == myHookNumber) {
                buildFlagList();
            }
        });
        return;
    }

    // Custom group data
    if(data.isCustomGroup) {
        for(var abilityName in data.data) {
            Game.shared.abilityCustomGroups[abilityName] = data.groupName;
        }
        return;
    }
}

// Selected heroes has changed
function onSelectedHeroChanged(data) {
    // Grab data
    var playerID = data.playerID;
    //var heroName = data.heroName;

    // Was it an update on our local player?
    if(playerID == Players.GetLocalPlayer()) {
        // Update our hero icon and text
        //pickingPhasePanel.onSelectedHeroChanged();

        // We have now picked a hero
        pickedAHero = true;
    }

    // Shows which heroes have been taken
    //pickingPhasePanel.showTakenHeroes();
    //pickingPhasePanel.updateHeroPreviewFilters();
    //pickingPhasePanel.updateRecommendedBuildFilters();

    //if(activePlayerPanels[playerID]) {
    //    activePlayerPanels[playerID].OnGetHeroData(heroName);
    //}

    //if(activeReviewPanels[playerID]) {
    //    activeReviewPanels[playerID].OnGetHeroData(heroName);
//
//        if(currentPhase == Game.shared.PHASE_REVIEW) {
//            activeReviewPanels[playerID].OnReviewPhaseStart();
//        }
//    }
}

// Selected primary attribute changes
function OnSelectedAttrChanged(table_name, key, data) {
    // Grab data
    var playerID = data.playerID;
    var newAttr = data.newAttr;

    // Store the change
    Game.shared.selectedAttr[playerID] = newAttr;

    // Trigger the event
    Game.shared.events.trigger('attrChanged', {
        playerID: playerID,
        newAttr: newAttr
    });

    // Was it an update on our local player?
    if(playerID == Players.GetLocalPlayer()) {
        // Update which attribute is selected
        //pickingPhasePanel.onHeroAttributeChanged();
    }

    // Push the attribute
    if(activePlayerPanels[playerID]) {
        //activePlayerPanels[playerID].OnGetNewAttribute(newAttr);
    }

    if(activeReviewPanels[playerID]) {
        //activeReviewPanels[playerID].OnGetNewAttribute(newAttr);
    }
}

// Selected abilities has changed
function OnSelectedSkillsChanged(table_name, key, data) {
    var playerID = data.playerID;

    // Store the change
    Game.shared.selectedSkills[playerID] = data.skills;

    // Fire the event
    Game.shared.events.trigger('buildChanged', {
        playerID: playerID,
        newSkills: data.skills
    })

    // Grab max slots
    var maxSlots = Game.shared.optionValueList['lodOptionCommonMaxSlots'] || 6;
    var defaultSkill = 'life_stealer_empty_1';

    if(playerID == Players.GetLocalPlayer()) {
        //pickingPhasePanel.onHeroBuildUpdated();
    }

    // Push the build
    if(activePlayerPanels[playerID]) {
        //activePlayerPanels[playerID].OnGetHeroBuildData(data.skills);
    }

    if(activeReviewPanels[playerID]) {
        //activeReviewPanels[playerID].OnGetHeroBuildData(data.skills);
    }

    // Update which skills are taken
    updateTakenSkills();
}

// Updates which skills have been taken
function updateTakenSkills() {
    var myTeam = (Game.GetPlayerInfo(Players.GetLocalPlayer()) || {}).player_team_id || -1;

    // Reset taken skills
    Game.shared.takenTeamAbilities = {};
    Game.shared.takenAbilities = {};

    // Loop over each build
    for(var playerID in Game.shared.selectedSkills) {
        var build = Game.shared.selectedSkills[playerID];

        var theTeam = (Game.GetPlayerInfo(parseInt(playerID)) || {}).player_team_id || -1;

        for(var slotID in build) {
            var abilityName = build[slotID];

            // This ability is taken
            Game.shared.takenAbilities[abilityName] = true;

            if(myTeam == theTeam) {
                Game.shared.takenTeamAbilities[abilityName] = true;
            }
        }
    }

    // Rebuild the visible skills
    pickingPhasePanel.calculateFilters();
    pickingPhasePanel.updateHeroPreviewFilters();
    pickingPhasePanel.updateRecommendedBuildFilters();
}

// A ban was sent through
function OnSkillBanned(table_name, key, data) {
    var heroName = data.heroName;
    var abilityName = data.abilityName;
    var playerInfo = data.playerInfo;

    if(heroName != null) {
        // Store the ban
        Game.shared.bannedHeroes[heroName] = true;

        // Recalculate filters
        pickingPhasePanel.calculateHeroFilters();
        pickingPhasePanel.updateHeroPreviewFilters();
        pickingPhasePanel.updateRecommendedBuildFilters();
    }

    if(abilityName != null) {
        // Store the ban
        Game.shared.bannedAbilities[abilityName] = true;

        // Recalculate filters
        pickingPhasePanel.calculateFilters();
        pickingPhasePanel.updateHeroPreviewFilters();
        pickingPhasePanel.updateRecommendedBuildFilters();
    }

    if(data.playerID != null) {
        // Someone's ban info
        if(data.playerID == Players.GetLocalPlayer()) {
            // Our banning info

            // Store new values
            currentHeroBans = data.currentHeroBans;
            currentAbilityBans = data.currentAbilityBans;

            // Recalculate
            recalculateBanLimits();
        }
    }
}

// Server just sent the ready state
function OnGetReadyState(table_name, key, data) {
    // Store it
    Game.shared.readyState = data;

    // Fire the event
    Game.shared.events.trigger('readyChanged', data);

    // Process it
    for(var playerID in data) {
        var panel = activePlayerPanels[playerID];
        if(panel) {
            //panel.setReadyState(data[playerID])
        }

        var panel = activeReviewPanels[playerID];
        if(panel) {
            //panel.setReadyState(data[playerID])
        }

        // Is it our local player?
        if(playerID == Players.GetLocalPlayer()) {
            var playerIsReady = data[playerID] == 1;

            // Push the data, push it real, good
            //pickingPhasePanel.setReadyState(playerIsReady);
            $('#allRandomLockButton').visible = !playerIsReady;
            $('#reviewReadyButton').visible = !playerIsReady;
        }
    }
}

// Server just sent us random build data
var allRandomBuildContainers = {};
var allRandomSelectedBuilds = {
    hero: 0,
    build: 0
};
function OnGetRandomBuilds(table_name, key, data) {
    if(data.selected != null) {
        OnSelectedRandomBuildChanged(table_name, key, data);
        return;
    }

    // See who's data we just got
    var playerID = data.playerID;
    if(playerID == Players.GetLocalPlayer()) {
        // It's our data!
        var builds = data.builds;

        // ASSUMPTION: This event will only fire ONCE!

        var con = $('#allRandomBuildsContainer');

        for(var buildID in builds) {
            var theBuild = builds[buildID];

            // Create the container
            var buildCon = $.CreatePanel('Panel', con, 'allRandomBuild' + buildID);
            buildCon.BLoadLayout('file://{resources}/layout/custom_game/all_random_build.xml', false, false);
            buildCon.setBuild(buildID, theBuild.heroName, theBuild.build);
            buildCon.hook(Game.shared.hookSkillInfo);

            allRandomBuildContainers[buildID] = buildCon;
        }

        updateAllRandomHighlights();
    }
}

// The build we selected changed
function OnSelectedRandomBuildChanged(table_name, key, data) {
    // See who's data we just got
    var playerID = data.playerID;

    if(playerID == Players.GetLocalPlayer()) {
        allRandomSelectedBuilds.hero = data.hero;
        allRandomSelectedBuilds.build = data.build;
        updateAllRandomHighlights();
    }
}

// Server just sent us a draft array
function OnGetDraftArray(table_name, key, data) {
    var draftID = data.draftID;

    var playerID = Players.GetLocalPlayer();
    var myInfo = Game.GetPlayerInfo(playerID);
    var myTeamID = myInfo.player_team_id;
    var myTeamPlayers = Game.GetPlayerIDsOnTeam(myTeamID);

    var draftPlayers = data.draftPlayers;

    // Does this player own it?
    if(!draftPlayers[playerID]) return;

    var draftArray = data.draftArray;
    Game.shared.heroDraft = draftArray.heroDraft;
    Game.shared.abilityDraft = draftArray.abilityDraft;

    // Run the calculations
    pickingPhasePanel.calculateFilters();
    pickingPhasePanel.calculateHeroFilters();
    pickingPhasePanel.updateHeroPreviewFilters();
    pickingPhasePanel.updateRecommendedBuildFilters();

    // The draft array was updated
    Game.shared.events.trigger('draftArrayUpdated');
}

// Update the highlights
function updateAllRandomHighlights() {
    for(var buildID in allRandomBuildContainers) {
        var con = allRandomBuildContainers[buildID];
        con.setSelected(buildID == allRandomSelectedBuilds.hero, buildID == allRandomSelectedBuilds.build);
    }
}

// Build the flags list
function buildFlagList() {
    Game.shared.flagData = {};

    for(var abilityName in Game.shared.flagDataInverse) {
        var flags = Game.shared.flagDataInverse[abilityName];

        for(var flag in flags) {
            if(Game.shared.flagData[flag] == null) Game.shared.flagData[flag] = {};

            Game.shared.flagData[flag][abilityName] = flags[flag];
        }
    }
}

// STUB: TODO: REPLACE THIS
function makeHeroSelectable() {};

function onHeroFilterPressed(filterName) {
    switch(filterName) {
        case 'melee':
            if(heroFilterInfo.classType) {
                if(heroFilterInfo.classType == 'melee') {
                    delete heroFilterInfo.classType;
                } else {
                    heroFilterInfo.classType = 'melee';
                }
            } else {
                heroFilterInfo.classType = 'melee';
            }
        break;

        case 'ranged':
            if(heroFilterInfo.classType) {
                if(heroFilterInfo.classType == 'ranged') {
                    delete heroFilterInfo.classType;
                } else {
                    heroFilterInfo.classType = 'ranged';
                }
            } else {
                heroFilterInfo.classType = 'ranged';
            }
        break;

        case 'clear':
            delete heroFilterInfo.classType;
        break;
    }

    $('#heroPickingFiltersMelee').SetHasClass('lod_hero_filter_selected', heroFilterInfo.classType == 'melee');
    $('#heroPickingFiltersRanged').SetHasClass('lod_hero_filter_selected', heroFilterInfo.classType == 'ranged');
    $('#heroPickingFiltersClear').visible = heroFilterInfo.classType != null;

    // Calculate filters:
    pickingPhasePanel.calculateHeroFilters();
}

// Are we the host?
function isHost() {
    var playerInfo = Game.GetLocalPlayerInfo();
    if (!playerInfo) return false;
    return playerInfo.player_has_host_privileges;
}

// Sets an option to a value
function setOption(optionName, optionValue) {
    // Ensure we are the host
    if(!isHost()) return;

    // Don't send an update twice!
    if(lastOptionValues[optionName] && lastOptionValues[optionName] == optionValue) return;

    // Tell the server we changed a setting
    GameEvents.SendCustomGameEventToServer('lodOptionSet', {
        k: optionName,
        v: optionValue
    });
}

// Adds a player to the list of unassigned players
function addUnassignedPlayer(playerID) {
    // Grab the panel to insert into
    var unassignedPlayersContainerNode = $('#unassignedPlayersContainer');
    if (unassignedPlayersContainerNode == null) return;

    // Create the new panel
    var newPlayerPanel = activeUnassignedPanels[playerID];

    if(newPlayerPanel == null) {
        newPlayerPanel = $.CreatePanel('Panel', unassignedPlayersContainerNode, 'unassignedPlayer');
        newPlayerPanel.SetAttributeInt('playerID', playerID);
        newPlayerPanel.BLoadLayout('file://{resources}/layout/custom_game/unassigned_player.xml', false, false);
    } else {
        newPlayerPanel.visible = true;
    }

    // Store it
    activeUnassignedPanels[playerID] = newPlayerPanel;

    // Do we need to hide the team panel?
    if(activePlayerPanels[playerID] != null) {
        activePlayerPanels[playerID].visible = false;
    }

    if(activeReviewPanels[playerID] != null) {
        activeReviewPanels[playerID].visible = false;
    }

    // Add this panel to the list of panels we've generated
    //allPlayerPanels.push(newPlayerPanel);
}

// Adds a player to a team
function addPlayerToTeam(playerID, panel, reviewContainer, shouldMakeSmall) {
    // Validate the panel
    if(panel == null || reviewContainer == null) return;

    // Hide the unassigned container
    if(activeUnassignedPanels[playerID] != null) {
        activeUnassignedPanels[playerID].visible = false;
    }

    /*
        Create the panel at the top of the screen
    */

    // Create the new panel if we need one
    var newPlayerPanel = activePlayerPanels[playerID];

    if(newPlayerPanel == null) {
        newPlayerPanel = $.CreatePanel('Panel', panel, 'teamPlayer' + playerID);
        newPlayerPanel.SetAttributeInt('playerID', playerID);
        newPlayerPanel.BLoadLayout('file://{resources}/layout/custom_game/team_player.xml', false, false);
        newPlayerPanel.setPlayerID(playerID);
        //newPlayerPanel.hookStuff(Game.shared.hookSkillInfo, makeSkillSelectable, makeHeroSelectable);
    } else {
        newPlayerPanel.SetParent(panel);
        newPlayerPanel.visible = true;
    }

    // Check max slots
    var maxSlots = Game.shared.optionValueList['lodOptionCommonMaxSlots'];
    if(maxSlots != null) {
        //newPlayerPanel.OnGetHeroSlotCount(maxSlots);
    }

    // Check for hero icon
    if(Game.shared.selectedHeroes[playerID] != null) {
        //newPlayerPanel.OnGetHeroData(Game.shared.selectedHeroes[playerID]);
    }

    // Check for skill data
    if(Game.shared.selectedSkills[playerID] != null) {
        //newPlayerPanel.OnGetHeroBuildData(Game.shared.selectedSkills[playerID]);
    }

    // Check for attr data
    if(Game.shared.selectedAttr[playerID] != null) {
        //newPlayerPanel.OnGetNewAttribute(Game.shared.selectedAttr[playerID]);
    }

    // Check for ready state
    if(Game.shared.readyState[playerID] != null) {
        //newPlayerPanel.setReadyState(Game.shared.readyState[playerID]);
    }

    // Add this panel to the list of panels we've generated
    //allPlayerPanels.push(newPlayerPanel);
    activePlayerPanels[playerID] = newPlayerPanel;

    /*
        Create the panel in the review screen
    */

    // Create the new panel
    var newPlayerPanel = activeReviewPanels[playerID];

    if(newPlayerPanel == null) {
        newPlayerPanel = $.CreatePanel('Panel', reviewContainer, 'reviewPlayer' + playerID);
        newPlayerPanel.SetAttributeInt('playerID', playerID);
        newPlayerPanel.BLoadLayout('file://{resources}/layout/custom_game/team_player_review.xml', false, false);
        newPlayerPanel.setPlayerID(playerID);
        //newPlayerPanel.hookStuff(Game.shared.hookSkillInfo, Game.shared.makeSkillSelectable, pickingPhasePanel.setSelectedHelperHero, playerID == Players.GetLocalPlayer());
    } else {
        newPlayerPanel.SetParent(reviewContainer);
        newPlayerPanel.visible = true;
    }

    newPlayerPanel.setShouldBeSmall(shouldMakeSmall);

    // Check max slots
    var maxSlots = Game.shared.optionValueList['lodOptionCommonMaxSlots'];
    if(maxSlots != null) {
        //newPlayerPanel.OnGetHeroSlotCount(maxSlots);
    }

    // Check for hero icon
    /*if(Game.shared.selectedHeroes[playerID] != null) {
        //newPlayerPanel.OnGetHeroData(Game.shared.selectedHeroes[playerID]);

        if(currentPhase == Game.shared.PHASE_REVIEW) {
            newPlayerPanel.OnReviewPhaseStart();
        }
    }*/

    // Check for skill data
    if(Game.shared.selectedSkills[playerID] != null) {
        //newPlayerPanel.OnGetHeroBuildData(Game.shared.selectedSkills[playerID]);
    }

    // Check for attr data
    if(Game.shared.selectedAttr[playerID] != null) {
        //newPlayerPanel.OnGetNewAttribute(Game.shared.selectedAttr[playerID]);
    }

    // Check for ready state
    if(Game.shared.readyState[playerID] != null) {
        //newPlayerPanel.setReadyState(Game.shared.readyState[playerID]);
    }

    // Add this panel to the list of panels we've generated
    //allPlayerPanels.push(newPlayerPanel);
    activeReviewPanels[playerID] = newPlayerPanel;
}

// Build the options categories
function buildOptionsCategories() {
    // Grab the main container for option categories
    var catContainer = $('#optionCategories');
    var optionContainer = $('#optionList');

    // Reset option links
    allOptionLinks = {};

    // Loop over all the option labels
    for(var optionLabelText in allOptions) {
        // Create a new scope
        (function(optionLabelText, optionData) {
            // The button
            var optionCategory = $.CreatePanel('Button', catContainer, 'option_button_' + optionLabelText);
            optionCategory.SetAttributeString('cat', optionLabelText);
            //optionCategory.AddClass('PlayButton');
            //optionCategory.AddClass('RadioBox');
            //optionCategory.AddClass('HeroGridNavigationButtonBox');
            //optionCategory.AddClass('NavigationButtonGlow');
            optionCategory.AddClass('OptionButton');

            var innerPanel = $.CreatePanel('Panel', optionCategory, 'option_button_' + optionLabelText + '_fancy');
            innerPanel.AddClass('OptionButtonFancy');

            var innerPanelTwo = $.CreatePanel('Panel', optionCategory, 'option_button_' + optionLabelText + '_glow');
            innerPanelTwo.AddClass('OptionButtonGlow');

            // Check if this requires custom settings
            if(optionData.custom) {
                optionCategory.AddClass('optionButtonCustomRequired');
            }

            // Check for bot settings
            if(optionData.bot) {
                optionCategory.AddClass('optionButtonBotRequired');
            }

            // Button text
            var optionLabel = $.CreatePanel('Label', optionCategory, 'option_button_' + optionLabelText + '_label');
            optionLabel.text = $.Localize(optionLabelText + '_lod');
            optionLabel.AddClass('OptionButtonLabel');

            // The panel
            var optionPanel = $.CreatePanel('Panel', optionContainer, 'option_panel_' + optionLabelText);
            optionPanel.AddClass('OptionPanel');

            if(optionData.custom) {
                optionPanel.AddClass('optionButtonCustomRequired');
            }

            if(optionData.bot) {
                optionPanel.AddClass('optionButtonBotRequired');
            }

            // Build the fields
            var fieldData = optionData.fields;

            for(var i=0; i<fieldData.length; ++i) {
                // Create new script scope
                (function() {
                    // Grab info about this field
                    var info = fieldData[i];
                    var fieldName = info.name;
                    var sort = info.sort;
                    var values = info.values;

                    // Create the info
                    var mainSlot = $.CreatePanel('Panel', optionPanel, 'option_panel_main_' + fieldName);
                    mainSlot.AddClass('optionSlotPanel');
                    var infoLabel = $.CreatePanel('Label', mainSlot, 'option_panel_main_' + fieldName);
                    infoLabel.text = $.Localize(info.des);
                    infoLabel.AddClass('optionSlotPanelLabel');

                    mainSlot.SetPanelEvent('onmouseover', function() {
                        $.DispatchEvent('DOTAShowTitleTextTooltipStyled', mainSlot, info.des, info.about, 'testStyle');
                    });

                    mainSlot.SetPanelEvent('onmouseout', function() {
                        $.DispatchEvent('DOTAHideTitleTextTooltip');
                    });

                    // Is this a preset?
                    if(info.preset) {
                        mainSlot.AddClass('optionSlotPanelNoCustom');
                    }

                    var floatRightContiner = $.CreatePanel('Panel', mainSlot, 'option_panel_field_' + fieldName + '_container');
                    floatRightContiner.AddClass('optionsSlotPanelContainer');

                    // Create stores for the newly created items
                    var hostPanel;
                    var slavePanel = $.CreatePanel('Label', floatRightContiner, 'option_panel_field_' + fieldName + '_slave');
                    slavePanel.AddClass('optionsSlotPanelSlave');
                    slavePanel.AddClass('optionSlotPanelLabel');
                    slavePanel.text = 'Unknown';

                    switch(sort) {
                        case 'dropdown':
                            // Create the drop down
                            hostPanel = $.CreatePanel('DropDown', floatRightContiner, 'option_panel_field_' + fieldName);
                            hostPanel.AddClass('optionsSlotPanelHost');

                            // Maps values to panels
                            var valueToPanel = {};

                            for(var j=0; j<values.length; ++j) {
                                var valueInfo = values[j];
                                var fieldText = valueInfo.text;
                                var fieldValue = valueInfo.value;

                                var subPanel = $.CreatePanel('Label', hostPanel.AccessDropDownMenu(), 'option_panel_field_' + fieldName + '_' + fieldText);
                                subPanel.text = $.Localize(fieldText);
                                //subPanel.SetAttributeString('fieldText', fieldText);
                                subPanel.SetAttributeInt('fieldValue', fieldValue);
                                hostPanel.AddOption(subPanel);

                                // Store the map
                                valueToPanel[fieldValue] = 'option_panel_field_' + fieldName + '_' + fieldText;

                                if(j == values.length-1) {
                                    hostPanel.SetSelected(valueToPanel[fieldValue]);
                                }
                            }

                            // Mapping function
                            optionFieldMap[fieldName] = function(newValue) {
                                for(var i=0; i<values.length; ++i) {
                                    var valueInfo = values[i];
                                    var fieldText = valueInfo.text;
                                    var fieldValue = valueInfo.value;

                                    if(fieldValue == newValue) {
                                        var thePanel = valueToPanel[fieldValue];
                                        if(thePanel) {
                                            // Select that panel
                                            hostPanel.SetSelected(thePanel);

                                            // Update text
                                            slavePanel.text = $.Localize(fieldText);
                                            break;
                                        }
                                    }
                                }
                            }

                            // When the data changes
                            hostPanel.SetPanelEvent('oninputsubmit', function() {
                                // Grab the selected one
                                var selected = hostPanel.GetSelected();
                                //var fieldText = selected.GetAttributeString('fieldText', -1);
                                var fieldValue = selected.GetAttributeInt('fieldValue', -1);

                                // Sets an option
                                setOption(fieldName, fieldValue);
                            });
                        break;

                        case 'range':
                            // Create the Container
                            hostPanel = $.CreatePanel('Panel', floatRightContiner, 'option_panel_field_' + fieldName);
                            hostPanel.BLoadLayout('file://{resources}/layout/custom_game/shared/ui/slider.xml', false, false);
                            hostPanel.AddClass('optionsSlotPanelHost');

                            // When the value is changed
                            hostPanel.onComplete(function(newValue) {
                                setOption(fieldName, newValue);
                            });

                            // Init
                            hostPanel.initSlider(info.step, info.min, info.max, info.default);

                            // When the option changes, update the slider
                            optionFieldMap[fieldName] = function(newValue) {
                                hostPanel.setCurrentValue(newValue);
                                slavePanel.text = newValue;
                            }
                        break;

                        case 'toggle':
                            // Create the toggle box
                            hostPanel = $.CreatePanel('ToggleButton', floatRightContiner, 'option_panel_field_' + fieldName);
                            hostPanel.AddClass('optionsSlotPanelHost');
                            hostPanel.AddClass('optionsHostToggleSelector');

                            // When the checkbox has been toggled
                            var checkboxToggled = function() {
                                // Check if it is checked or not
                                if(hostPanel.checked) {
                                    setOption(fieldName, 1);
                                    hostPanel.text = values[1].text;
                                    slavePanel.text = $.Localize(values[1].text);
                                } else {
                                    setOption(fieldName, 0);
                                    hostPanel.text = values[0].text;
                                    slavePanel.text = $.Localize(values[0].text);
                                }
                            }

                            // When the data changes
                            hostPanel.SetPanelEvent('onactivate', checkboxToggled);

                            // Mapping function
                            optionFieldMap[fieldName] = function(newValue) {
                                hostPanel.checked = newValue == 1;

                                if(hostPanel.checked) {
                                    hostPanel.text = $.Localize(values[1].text);
                                    slavePanel.text = $.Localize(values[1].text);
                                } else {
                                    hostPanel.text = $.Localize(values[0].text);
                                    slavePanel.text = $.Localize(values[0].text);
                                }
                            }

                            // When the main slot is pressed
                            mainSlot.SetPanelEvent('onactivate', function() {
                                if(!hostPanel.visible) return;

                                hostPanel.checked = !hostPanel.checked;
                                checkboxToggled();
                            });
                        break;
                    }
                })();
            }

            // Fix stuff
            $.CreatePanel('Label', optionPanel, 'option_panel_fixer_' + optionLabelText);

            // Store the reference
            allOptionLinks[optionLabelText] = {
                panel: optionPanel,
                button: optionCategory
            }

            // The function to run when it is activated
            function whenActivated() {
                // Disactivate all other ones
                for(var key in allOptionLinks) {
                    var data = allOptionLinks[key];

                    data.panel.SetHasClass('activeMenu', false);
                    data.button.SetHasClass('activeMenu', false);
                }

                // Activate our one
                optionPanel.SetHasClass('activeMenu', true);
                optionCategory.SetHasClass('activeMenu', true);

                // If we are the host, tell the server which menu we are looking at
                if(isHost()) {
                    GameEvents.SendCustomGameEventToServer('lodOptionsMenu', {v: optionLabelText});
                }
            }

            // When the button is clicked
            optionCategory.SetPanelEvent('onactivate', whenActivated);

            // Check if it is default
            if(optionData.default) {
                whenActivated();
            }
        })(optionLabelText, allOptions[optionLabelText]);
    }
}

// Player presses auto assign
function onAutoAssignPressed() {
    // Auto assign teams
    Game.AutoAssignPlayersToTeams();

    // Lock teams
    Game.SetTeamSelectionLocked(true);
}

// Player presses shuffle
function onShufflePressed() {
    // Shuffle teams
    Game.ShufflePlayerTeamAssignments();
}

// Player presses lock teams
function onLockPressed() {
    // Don't allow a forced start if there are unassigned players
    if (Game.GetUnassignedPlayerIDs().length > 0)
        return;

    // Lock the team selection so that no more team changes can be made
    Game.SetTeamSelectionLocked(true);
}

// Player presses unlock teams
function onUnlockPressed() {
    // Unlock Teams
    Game.SetTeamSelectionLocked(false);
}

// Lock options pressed
function onLockOptionsPressed() {
    // Ensure teams are locked
    if(!Game.GetTeamSelectionLocked()) return;

    // Lock options
    GameEvents.SendCustomGameEventToServer('lodOptionsLocked', {});
}

// Player tries to join radiant
function onJoinRadiantPressed() {
    // Attempt to join radiant
    Game.PlayerJoinTeam(DOTATeam_t.DOTA_TEAM_GOODGUYS);
}

// Player tries to join dire
function onJoinDirePressed() {
    // Attempt to join dire
    Game.PlayerJoinTeam(DOTATeam_t.DOTA_TEAM_BADGUYS);
}

// Player tries to join unassigned
function onJoinUnassignedPressed() {
    // Attempt to join unassigned
    Game.PlayerJoinTeam(DOTATeam_t.DOTA_TEAM_NOTEAM);
}

// Does the actual update
function doActualTeamUpdate() {
    // Create a panel for each of the unassigned players
    var unassignedPlayers = Game.GetUnassignedPlayerIDs();
    for(var i=0; i<unassignedPlayers.length; ++i) {
        // Add this player to the unassigned list
        addUnassignedPlayer(unassignedPlayers[i]);
    }

    var theCon;
    var theConMain;

    var radiantTopContainer = $('#theRadiantContainer');
    var radiantTopContainerTop = $('#theRadiantContainerTop');
    var radiantTopContainerBot = $('#theRadiantContainerBot');

    var reviewRadiantContainer = $('#reviewRadiantTeam');
    var reviewRadiantTopContainer = $('#reviewPhaseRadiantTeamTop');
    var reviewRadiantBotContainer = $('#reviewPhaseRadiantTeamBot');

    // Add radiant players
    var radiantPlayers = Game.GetPlayerIDsOnTeam(DOTATeam_t.DOTA_TEAM_GOODGUYS);
    for(var i=0; i<radiantPlayers.length; ++i) {
        if(radiantPlayers.length <= 5) {
            theCon = reviewRadiantContainer;
            theConMain = radiantTopContainer;
        } else {
            if(i < 5) {
                theCon = reviewRadiantTopContainer;
                theConMain = radiantTopContainerTop;
            } else {
                theCon = reviewRadiantBotContainer;
                theConMain = radiantTopContainerBot;
            }
        }

        // Add this player to radiant
        addPlayerToTeam(radiantPlayers[i], theConMain, theCon, radiantPlayers.length > 5);
    }

    // Do we have more than 5 players on radiant?
    radiantTopContainer.SetHasClass('tooManyPlayers', radiantPlayers.length > 5);
    reviewRadiantContainer.SetHasClass('tooManyPlayers', radiantPlayers.length > 5);

    var direTopContainer = $('#theDireContainer');
    var direTopContainerTop = $('#theDireContainerTop');
    var direTopContainerBot = $('#theDireContainerBot');

    var reviewDireContainer = $('#reviewDireTeam');
    var reviewDireTopContainer = $('#reviewPhaseDireTeamTop');
    var reviewDireBotContainer = $('#reviewPhaseDireTeamBot');

    // Add radiant players
    var direPlayers = Game.GetPlayerIDsOnTeam(DOTATeam_t.DOTA_TEAM_BADGUYS);
    for(var i=0; i<direPlayers.length; ++i) {
        if(direPlayers.length <= 5) {
            theCon = reviewDireContainer;
            theConMain = direTopContainer;
        } else {
            if(i < 5) {
                theCon = reviewDireTopContainer;
                theConMain = direTopContainerTop;
            } else {
                theCon = reviewDireBotContainer;
                theConMain = direTopContainerBot;
            }
        }

        // Add this player to dire
        addPlayerToTeam(direPlayers[i], theConMain, theCon, direPlayers.length > 5);
    }

    // Do we have more than 5 players on radiant?
    direTopContainer.SetHasClass('tooManyPlayers', direPlayers.length > 5);
    reviewDireContainer.SetHasClass('tooManyPlayers', direPlayers.length > 5);

    // Update all of the team panels moving the player panels for the
    // players assigned to each team to the corresponding team panel.
    /*for ( var i = 0; i < g_TeamPanels.length; ++i )
    {
        UpdateTeamPanel( g_TeamPanels[ i ] )
    }*/

    // Set the class on the panel to indicate if there are any unassigned players
    $('#mainSelectionRoot').SetHasClass('unassigned_players', unassignedPlayers.length != 0 );
    $('#mainSelectionRoot').SetHasClass('no_unassigned_players', unassignedPlayers.length == 0 );

    // Hide the correct stuff
    calculateHideEnemyPicks();

    // Set host privledges
    var playerInfo = Game.GetLocalPlayerInfo();
    if (!playerInfo) return;

    $.GetContextPanel().SetHasClass('player_has_host_privileges', playerInfo.player_has_host_privileges);
}

//--------------------------------------------------------------------------------------------------
// Update the unassigned players list and all of the team panels whenever a change is made to the
// player team assignments
//--------------------------------------------------------------------------------------------------
var teamUpdateInProgress = false;
var needsAnotherUpdate = false;
function OnTeamPlayerListChanged() {
    if(teamUpdateInProgress) {
        needsAnotherUpdate = true;
        return;
    }
    teamUpdateInProgress = true;

    // Do the update
    doActualTeamUpdate();

    // Give a delay before allowing another update
    $.Schedule(0.5, function() {
        teamUpdateInProgress = false;

        if(needsAnotherUpdate) {
            needsAnotherUpdate = false;
            OnTeamPlayerListChanged();
        }
    });
}

//--------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------
function OnPlayerSelectedTeam( nPlayerId, nTeamId, bSuccess ) {
    var playerInfo = Game.GetLocalPlayerInfo();
    if (!playerInfo) return;

    // Check to see if the event is for the local player
    if (playerInfo.player_id === nPlayerId) {
        // Play a sound to indicate success or failure
        if (bSuccess) {
            Game.EmitSound('ui_team_select_pick_team');
        } else {
            Game.EmitSound('ui_team_select_pick_team_failed');
        }
    }
}

// Update the CSS on a panel to tell what phase we are in
function updatePhaseCSS(panel) {
    panel.SetHasClass('phase_loading', currentPhase == Game.shared.PHASE_LOADING);
    panel.SetHasClass('phase_option_selection', currentPhase == Game.shared.PHASE_OPTION_SELECTION);
    panel.SetHasClass('phase_option_voting', currentPhase == Game.shared.PHASE_OPTION_VOTING);
    panel.SetHasClass('phase_banning', currentPhase == Game.shared.PHASE_BANNING);
    panel.SetHasClass('phase_selection', currentPhase == Game.shared.PHASE_SELECTION);
    panel.SetHasClass('phase_all_random', currentPhase == Game.shared.PHASE_RANDOM_SELECTION);
    panel.SetHasClass('phase_drafting', currentPhase == Game.shared.PHASE_DRAFTING);
    panel.SetHasClass('phase_review', currentPhase == Game.shared.PHASE_REVIEW);
    panel.SetHasClass('phase_ingame', currentPhase == Game.shared.PHASE_INGAME);
}

// A phase was changed
var seenPopupMessages = {};
function OnPhaseChanged(table_name, key, data) {
    switch(key) {
        case 'phase':
            // Update the current phase
            currentPhase = data.v;
            Game.shared.currentPhase = data.v;

            // Run the trigger
            Game.shared.events.trigger('phaseChanged', {
                newPhase: currentPhase
            });


            // Update phase classes
            updatePhaseCSS($.GetContextPanel());
            updatePhaseCSS(pickingPhasePanel);


            // Progrss to the new phase
            SetSelectedPhase(currentPhase, true);

            // Message for hosters
            if(currentPhase == Game.shared.PHASE_OPTION_SELECTION) {
                // Should we show the host message popup?
                if(!seenPopupMessages.hostWarning) {
                    seenPopupMessages.hostWarning = true;
                    if(isHost()) {
                        showPopupMessage('lodHostingMessage');
                    } else {
                        showPopupMessage('lodHostingNoobMessage');
                    }
                }
            }

            // Message voting
            /*if(currentPhase == Game.shared.PHASE_OPTION_VOTING) {
                // Should we show the host message popup?
                if(!seenPopupMessages.optionVoting) {
                    seenPopupMessages.optionVoting = true;
                    showPopupMessage('lodOptionVoting');
                }
            }*/

            // Message for banning phase
            if(currentPhase == Game.shared.PHASE_BANNING) {
                // Should we show the host message popup?
                if(!seenPopupMessages.skillBanningInfo) {
                    seenPopupMessages.skillBanningInfo = true;
                    showPopupMessage('lodBanningMessage');
                }
            }

            // Message for players selecting skills
            if(currentPhase == Game.shared.PHASE_SELECTION) {
                // Should we show the host message popup?
                if(!seenPopupMessages.skillDraftingInfo) {
                    seenPopupMessages.skillDraftingInfo = true;
                    showPopupMessage('lodPickingMessage');
                }
            }

            // Message for players selecting skills
            if(currentPhase == Game.shared.PHASE_REVIEW) {
                // Should we show the host message popup?
                if(!seenPopupMessages.skillReviewInfo) {
                    seenPopupMessages.skillReviewInfo = true;
                    showPopupMessage('lodReviewMessage');
                }

                // Load all hero images
                for(var playerID in activeReviewPanels) {
                    //activeReviewPanels[playerID].OnReviewPhaseStart();
                }
            }

            // Push the current phase info into the panel

        break;

        case 'endOfTimer':
            // Store the end time
            endOfTimer = data.v;
        break;

        case 'activeTab':
            var newActiveTab = data.v;

            for(var key in allOptionLinks) {
                // Grab reference
                var info = allOptionLinks[key];
                var optionButton = info.button;

                // Set active one
                optionButton.SetHasClass('activeHostMenu', key == newActiveTab);
            }
        break;

        case 'freezeTimer':
            freezeTimer = data.v;
        break;

        case 'doneCaching':
            // No longer waiting for precache
            waitingForPrecache = false;
        break;

        case 'vote_counts':
            // Server just sent us vote counts

            // Defaults
            data.banning = data.banning || {};
            data.slots = data.slots || {};

            // Set vote counts
            $('#voteCountNo').text = '(' + (data.banning[0] || 0) + ')';
            $('#voteCountYes').text = '(' + (data.banning[1] || 0) + ')';

            $('#voteCountSlots4').text = (data.slots[4] || 0);
            $('#voteCountSlots5').text = (data.slots[5] || 0);
            $('#voteCountSlots6').text = (data.slots[6] || 0);
        break;

        case 'premium_info':
            var playerID = Players.GetLocalPlayer();

            if(data[playerID] != null) {
                // Store if we are a premium player
                isPremiumPlayer = data[playerID] > 0;
                $.GetContextPanel().SetHasClass('premiumUser', isPremiumPlayer);
            }
        break;
    }

    // Ensure we are hiding the correct enemy picks
    calculateHideEnemyPicks();
}

// An option just changed
function OnOptionChanged(table_name, key, data) {
    // Store new value
    Game.shared.optionValueList[key] = data.v;

    // Check if there is a mapping function available
    if(optionFieldMap[key]) {
        // Yep, run it!
        optionFieldMap[key](data.v);
    }

    // Check for the custom stuff
    if(key == 'lodOptionGamemode') {
        // Check if we are allowing custom settings
        allowCustomSettings = data.v == -1;
        $.GetContextPanel().SetHasClass('allow_custom_settings', allowCustomSettings);
        $.GetContextPanel().SetHasClass('disallow_custom_settings', !allowCustomSettings);
    }

    if(key == 'lodOptionCommonGamemode') {
        // Mirror draft options
        var showMirrorDraftOptions = data.v == 3 || data.v == 5;

        $('#option_panel_main_lodOptionMirrorHeroes').SetHasClass('showThis', showMirrorDraftOptions);
        $('#option_panel_main_lodOptionCommonMirrorHeroes').visible = showMirrorDraftOptions;
    }

    // Check for allowed categories changing
    //if(key == 'lodOptionAdvancedHeroAbilities' || key == 'lodOptionAdvancedNeutralAbilities' || key == 'lodOptionAdvancedNeutralWraithNight' || key == 'lodOptionAdvancedOPAbilities') {
    if(key == 'lodOptionAdvancedHeroAbilities' || key == 'lodOptionAdvancedNeutralAbilities' || key == 'lodOptionAdvancedOPAbilities') {
        allowedCategoriesChanged();
    }

    // Check if it's the number of slots allowed
    if(key == 'lodOptionCommonMaxSkills' || key == 'lodOptionCommonMaxSlots' || key == 'lodOptionCommonMaxUlts') {
        Game.shared.events.trigger('maxSlotsChanged');
        onMaxSlotsChanged();
    }

    // Check for banning phase
    if(key == 'lodOptionBanningMaxBans' || key == 'lodOptionBanningMaxHeroBans' || key == 'lodOptionBanningHostBanning') {
        onMaxBansChanged();
    }

    // Check for unique abilities changing
    if(key == 'lodOptionAdvancedUniqueSkills') {
        pickingPhasePanel.calculateFilters();
        pickingPhasePanel.updateHeroPreviewFilters();
        pickingPhasePanel.updateRecommendedBuildFilters();
    }

    if(key == 'lodOptionAdvancedUniqueSkills') {
        $('#mainSelectionRoot').SetHasClass('unique_skills_mode', Game.shared.optionValueList['lodOptionAdvancedUniqueSkills'] > 0);
    }

    if(key == 'lodOptionAdvancedUniqueHeroes') {
        $('#mainSelectionRoot').SetHasClass('unique_heroes_mode', Game.shared.optionValueList['lodOptionAdvancedUniqueHeroes'] == 1);
    }

    if(key == 'lodOptionCommonGamemode') {
        onGamemodeChanged();
    }

    if(key == 'lodOptionAdvancedHidePicks') {
        // Hide enemy picks
        hideEnemyPicks = data.v == 1;
        calculateHideEnemyPicks();
    }
}

// Recalculates how many abilities / heroes we can ban
function recalculateBanLimits() {
    var maxHeroBans = Game.shared.optionValueList['lodOptionBanningMaxHeroBans'] || 0;
    var maxAbilityBans = Game.shared.optionValueList['lodOptionBanningMaxBans'] || 0;
    var hostBanning = Game.shared.optionValueList['lodOptionBanningHostBanning'] || 0;

    // Is host banning enabled, and we are the host?
    if(hostBanning && isHost()) {
        $('#lodBanLimits').text = $.Localize('hostBanningPanelText');
        return;
    }

    var heroBansLeft = maxHeroBans - currentHeroBans;
    var abilityBansLeft = maxAbilityBans - currentAbilityBans;

    var txt = '';
    var txtMainLeft = $.Localize('lodYouCanBan');
    var txtHero = '';
    var txtAb = '';

    if(heroBansLeft > 0) {
        if(heroBansLeft > 1) {
            txtHero = $.Localize('lodUptoHeroes');
        } else {
            txtHero = $.Localize('lodUptoOneHero');
        }
    }

    if(abilityBansLeft > 0) {
        if(abilityBansLeft > 1) {
            txtAb = $.Localize('lodUptoAbilities');
        } else {
            txtAb = $.Localize('lodUptoAbility');
        }
    }

    if(heroBansLeft > 0) {
        txt = txtMainLeft + txtHero;

        if(abilityBansLeft > 0) {
            txt += $.Localize('lodBanAnd') + txtAb;
        }
    } else if(abilityBansLeft) {
        txt = txtMainLeft + txtAb;
    } else {
        txt = $.Localize('lodNoMoreBans');
    }

    // Add full stop
    txt += '.';

    txt = txt.replace(/\{heroBansLeft\}/g, heroBansLeft);
    txt = txt.replace(/\{abilityBansLeft\}/g, abilityBansLeft);

    // Push the text
    pickingPhasePanel.setMaxBans(txt);
}

// Recalculates what teams should be hidden
function calculateHideEnemyPicks() {
    // Hide picks
    var hideRadiantPicks = false;
    var hideDirePicks = false;

    if(hideEnemyPicks) {
        var playerInfo = Game.GetLocalPlayerInfo();
        if(playerInfo) {
            var teamID = playerInfo.player_team_id;

            if(teamID == DOTATeam_t.DOTA_TEAM_GOODGUYS) {
                hideDirePicks = true;
            }

            if(teamID == DOTATeam_t.DOTA_TEAM_BADGUYS) {
                hideRadiantPicks = true;
            }
        }
    }

    $('#theRadiantContainer').SetHasClass('hide_picks', hideRadiantPicks);
    $('#reviewRadiantTeam').SetHasClass('hide_picks', hideRadiantPicks);
    $('#theDireContainer').SetHasClass('hide_picks', hideDirePicks);
    $('#reviewDireTeam').SetHasClass('hide_picks', hideDirePicks);
}

// The gamemode has changed
function onGamemodeChanged() {
    var theGamemode = Game.shared.optionValueList['lodOptionCommonGamemode'];

    var noHeroSelection = false;

    if(theGamemode == 4) {
        // All Random
        noHeroSelection = true;
    }

    var masterRoot = $('#mainSelectionRoot');
    masterRoot.SetHasClass('no_hero_selection', noHeroSelection);

    // All random mode
    masterRoot.SetHasClass('all_random_mode', theGamemode == 4);
}

// Max number of bans has changed
function onMaxBansChanged() {
    var maxBans = Game.shared.optionValueList['lodOptionBanningMaxBans'];
    var maxHeroBans = Game.shared.optionValueList['lodOptionBanningMaxHeroBans'];
    var hostBanning = Game.shared.optionValueList['lodOptionBanningHostBanning'];

    // Hide / show the banning phase button
    if(maxBans != null && maxHeroBans != null && hostBanning != null) {
        var masterRoot = $('#mainSelectionRoot');
        masterRoot.SetHasClass('no_banning_phase', maxBans == 0 && maxHeroBans == 0 && hostBanning == 0);
    }

    // Recalculate limits
    recalculateBanLimits();
}

// The max number of slots / ults / regular abs has changed!
function onMaxSlotsChanged() {
    var maxSlots = Game.shared.optionValueList['lodOptionCommonMaxSlots'];
    var maxSkills = Game.shared.optionValueList['lodOptionCommonMaxSkills'];
    var maxUlts = Game.shared.optionValueList['lodOptionCommonMaxUlts'];

    // Ensure all variables are defined
    if(maxSlots == null || maxSkills == null || maxUlts == null) return;

    /*for(var i=1; i<=6; ++i) {
        var con = $('#lodYourAbility' + i);

        if(i <= maxSlots) {
            con.visible = true;
        } else {
            con.visible = false;
        }
    }*/

    // Push it
    for(var playerID in activePlayerPanels) {
        //activePlayerPanels[playerID].OnGetHeroSlotCount(maxSlots);
    }

    for(var playerID in activeReviewPanels) {
        //activeReviewPanels[playerID].OnGetHeroSlotCount(maxSlots);
    }

    // Do the highlight on the option voting
    for(var i=4; i<=6; ++i) {
        $('#optionVotingSlotAnswer' + i).RemoveClass('optionSlotsCurrentlySelected');
    }

    $('#optionVotingSlotAnswer' + maxSlots).AddClass('optionSlotsCurrentlySelected');
}

function allowedCategoriesChanged() {
    // Reset the allowed categories
    Game.shared.allowedCategories = {};

    if(Game.shared.optionValueList['lodOptionAdvancedHeroAbilities'] == 1) {
        Game.shared.allowedCategories['main'] = true;
    }

    if(Game.shared.optionValueList['lodOptionAdvancedNeutralAbilities'] == 1) {
        Game.shared.allowedCategories['neutral'] = true;
    }

    //if(Game.shared.optionValueList['lodOptionAdvancedNeutralWraithNight'] == 1) {
    //    Game.shared.allowedCategories['wraith'] = true;
    //}

    if(Game.shared.optionValueList['lodOptionAdvancedCustomSkills'] == 1) {
        Game.shared.allowedCategories['custom'] = true;
    }

    if(Game.shared.optionValueList['lodOptionAdvancedOPAbilities'] == 1) {
        Game.shared.allowedCategories['OP'] = true;
    }

    // Update the filters
    pickingPhasePanel.calculateFilters();
    pickingPhasePanel.updateHeroPreviewFilters();
    pickingPhasePanel.updateRecommendedBuildFilters();
}

// Changes which phase the player currently has selected
function SetSelectedPhase(newPhase, noSound) {
    if(newPhase > currentPhase) {
        Game.EmitSound('ui_team_select_pick_team_failed');
        return;
    }

    // Emit the click noise
    if(!noSound) Game.EmitSound('ui_team_select_pick_team');

    // Set the phase
    selectedPhase = newPhase;

    // Update CSS
    updateSelectedCSS($.GetContextPanel());
    updateSelectedCSS(pickingPhasePanel);

}

function updateSelectedCSS(panel) {
    panel.SetHasClass('phase_option_selection_selected', selectedPhase == Game.shared.PHASE_OPTION_SELECTION);
    panel.SetHasClass('phase_option_voting_selected', selectedPhase == Game.shared.PHASE_OPTION_VOTING);
    panel.SetHasClass('phase_banning_selected', selectedPhase == Game.shared.PHASE_BANNING);
    panel.SetHasClass('phase_selection_selected', selectedPhase == Game.shared.PHASE_SELECTION);
    panel.SetHasClass('phase_all_random_selected', selectedPhase == Game.shared.PHASE_RANDOM_SELECTION);
    panel.SetHasClass('phase_drafting_selected', selectedPhase == Game.shared.PHASE_DRAFTING);
    panel.SetHasClass('phase_review_selected', selectedPhase == Game.shared.PHASE_REVIEW);
}

// Return X:XX time (M:SS)
function getFancyTime(timeNumber) {
    // Are we dealing with a negative number?
    if(timeNumber >= 0) {
        // Nope, EZ
        var minutes = Math.floor(timeNumber / 60);
        var seconds = timeNumber % 60;

        if(seconds < 10) {
            seconds = '0' + seconds;
        }

        return minutes + ':' + seconds;
    } else {
        // Yes, use normal function, add a negative
        return '-' + getFancyTime(timeNumber * -1);
    }

}

//--------------------------------------------------------------------------------------------------
// Update the state for the transition timer periodically
//--------------------------------------------------------------------------------------------------
var updateTimerCounter = 0;
function UpdateTimer() {
    /*var gameTime = Game.GetGameTime();
    var transitionTime = Game.GetStateTransitionTime();

    CheckForHostPrivileges();

    var mapInfo = Game.GetMapInfo();
    $( "#MapInfo" ).SetDialogVariable( "map_name", mapInfo.map_display_name );

    if ( transitionTime >= 0 )
    {
        $( "#StartGameCountdownTimer" ).SetDialogVariableInt( "countdown_timer_seconds", Math.max( 0, Math.floor( transitionTime - gameTime ) ) );
        $( "#StartGameCountdownTimer" ).SetHasClass( "countdown_active", true );
        $( "#StartGameCountdownTimer" ).SetHasClass( "countdown_inactive", false );
    }
    else
    {
        $( "#StartGameCountdownTimer" ).SetHasClass( "countdown_active", false );
        $( "#StartGameCountdownTimer" ).SetHasClass( "countdown_inactive", true );
    }

    var autoLaunch = Game.GetAutoLaunchEnabled();
    $( "#StartGameCountdownTimer" ).SetHasClass( "auto_start", autoLaunch );
    $( "#StartGameCountdownTimer" ).SetHasClass( "forced_start", ( autoLaunch == false ) );*/

    // Allow the ui to update its state based on team selection being locked or unlocked
    $('#mainSelectionRoot').SetHasClass('teams_locked', Game.GetTeamSelectionLocked());
    $('#mainSelectionRoot').SetHasClass('teams_unlocked', Game.GetTeamSelectionLocked() == false);

    // Container to place the time into
    var placeInto = null;

    // Phase specific stuff
    switch(currentPhase) {
        case Game.shared.PHASE_OPTION_SELECTION:
            placeInto = $('#lodOptionSelectionTimeRemaining');
        break;

        case Game.shared.PHASE_OPTION_VOTING:
            placeInto = $('#lodOptionVotingTimeRemaining');
        break;

        case Game.shared.PHASE_BANNING:
            placeInto = $('#lodBanningTimeRemaining');
        break;

        case Game.shared.PHASE_SELECTION:
            placeInto = $('#lodSelectionTimeRemaining');
        break;

        case Game.shared.PHASE_RANDOM_SELECTION:
            placeInto = $('#lodRandomSelectionTimeRemaining');
        break;

        case Game.shared.PHASE_REVIEW:
            placeInto = $('#lodReviewTimeRemaining');
        break;
    }

    if(placeInto != null) {
        // Workout how long is left
        var currentTime = Game.Time();
        var timeLeft = Math.ceil(endOfTimer - currentTime);

        // Freeze timer
        if(freezeTimer != -1) {
            timeLeft = freezeTimer;
        }

        // Place the text
        placeInto.text = '(' + getFancyTime(timeLeft) + ')';

        // Text to show in the timer
        var theTimerText = ''

        // Make it more obvious how long is left
        if(freezeTimer != -1) {
            lastTimerShow = -1;
        } else {
            // Set how long is left
            theTimerText = getFancyTime(timeLeft);

            if(timeLeft <= 30 && !pickedAHero && currentPhase == Game.shared.PHASE_SELECTION) {
                theTimerText += '\n' + $.Localize('lodPickAHero');
            }

            var shouldShowTimer = false;

            if(lastTimerShow == -1) {
                // Timer was frozen, show the time
                shouldShowTimer = true;
            } else {
                if(timeLeft < lastTimerShow) {
                    shouldShowTimer = true;
                }
            }

            // Should we show the timer?
            if(shouldShowTimer) {
                // Work out how long to show for
                var showDuration = 3;

                // Calculate when the next show should occur
                if(timeLeft <= 30) {
                    // Always show
                    showDuration = timeLeft;

                    lastTimerShow = 0;
                } else {
                    // Show once every 30 seconds
                    lastTimerShow = Math.floor((timeLeft-1) / 30) * 30 + 1
                }

                $('#lodTimerWarningLabel').SetHasClass('showLodWarningTimer', true);

                // Used to fix timers disappearing at hte wrong time
                var myUpdateNumber = ++updateTimerCounter;

                //$('#lodTimerWarningLabel').visible = true;
                $.Schedule(showDuration, function() {
                    // Ensure there wasn't another timer scheduled
                    if(myUpdateNumber != updateTimerCounter) return;

                    //$('#lodTimerWarningLabel').visible = false;
                    $('#lodTimerWarningLabel').SetHasClass('showLodWarningTimer', false);
                });
            }
        }

        // Show the text
        $('#lodTimerWarningLabel').text = theTimerText;

        // Review override
        if(currentPhase == Game.shared.PHASE_REVIEW && waitingForPrecache) {
            $('#lodTimerWarningLabel').text = $.Localize('lodPrecaching');
            $('#lodTimerWarningLabel').SetHasClass('showLodWarningTimer', true);
        }
    }

    $.Schedule(0.1, UpdateTimer);
}

// Player has accepting the hosting message
function onAcceptPopup() {
    $('#lodPopupMessage').visible = false;
}

// Shows a popup message to a player
function showPopupMessage(msg) {
    $('#lodPopupMessageLabel').text = $.Localize(msg);
    $('#lodPopupMessage').visible = true;
}

// Cast a vote
function castVote(optionName, optionValue) {
    // Tell the server we clicked it
    GameEvents.SendCustomGameEventToServer('lodCastVote', {
        optionName: optionName,
        optionValue: optionValue
    });
}

// Player casts a vote
function onPlayerCastVote(category, choice) {
    // No voting unless it is the voting phase
    if(currentPhase != Game.shared.PHASE_OPTION_VOTING) return;

    switch(category) {
        case 'slots':
            // Remove glow
            for(var i=4; i<=6; ++i) {
                $('#optionVoteMaxSlots' + i).RemoveClass('makeThePlayerNoticeThisButton');
                $('#optionVoteMaxSlots' + i).RemoveClass('optionCurrentlySelected');
            }

            // Add the selection
            $('#optionVoteMaxSlots' + choice).AddClass('optionCurrentlySelected');

            // Send the vote to the server
            castVote(category, choice);
        break;

        case 'banning':
            // Remove glow
            $('#optionVoteBanningNo').RemoveClass('makeThePlayerNoticeThisButton');
            $('#optionVoteBanningNo').RemoveClass('optionCurrentlySelected');

            $('#optionVoteBanningYes').RemoveClass('makeThePlayerNoticeThisButton');
            $('#optionVoteBanningYes').RemoveClass('optionCurrentlySelected');

            // Add the selection
            var answer = 0;
            if(choice) {
                $('#optionVoteBanningYes').AddClass('optionCurrentlySelected');
                answer = 1;
            } else {
                $('#optionVoteBanningNo').AddClass('optionCurrentlySelected');
            }

            castVote(category, answer);
        break;
    }
}

// Export options
function onExportOptionsPressed() {
    //$.Msg(Game.shared.optionValueList)
    //$.Msg(JSON.stringify(Game.shared.optionValueList));

    $('#optionImporterEntry').text = JSON.stringify(Game.shared.optionValueList).replace(/,/g, ',\n');

    setImportError('exportSuccess', true);
}

function setImportError(msg, good) {
    if(msg == null) msg = '';

    $('#optionImporterErrorMessage').text = $.Localize(msg);
    $('#optionImporterErrorMessage').visible = true;

    $('#optionImporterErrorMessage').SetHasClass('isGoodMessage', good && true || false);
}

// Import Button
function onImportOptionsPressed() {
    var data = $('#optionImporterEntry').text;
    if(data.length == 0) {
        return setImportError('importFailedNoInput');
    }

    var decodeData;
    try {
        decodeData = JSON.parse(data);
    } catch(e) {
        return setImportError('importFailedInvalidJSON');
    }

    // Set preset first
    if(decodeData.lodOptionGamemode) {
        setOption('lodOptionGamemode', decodeData.lodOptionGamemode);
    }

    // Set each option
    for(var key in decodeData) {
        if(key == 'lodOptionGamemode') continue;
        setOption(key, decodeData[key]);
    }

    // Success
    setImportError('importSuccess', true);
}

// Close importer
function onImportCloseOptionsPressed() {
    $('#optionImporter').visible = false;
}

// Open Importer
function onImportOptionsOpenPressed() {
    $('#optionImporterErrorMessage').visible = false;
    $('#optionImporter').visible = true;
}

/*
    PICKING PHASE STUFF
*/

function setupPickingPhase() {
    // Load in the panel
    pickingPhasePanel = $.CreatePanel('Panel', $('#pickingPhase'), '');
    pickingPhasePanel.BLoadLayout('file://{resources}/layout/custom_game/shared/hero_builder/hero_builder_main.xml', false, false);
}

/*
    Review Phase Stuff
*/

// When the lock build button is pressed
function onLockBuildButtonPressed() {
    // Tell the server we clicked it
    GameEvents.SendCustomGameEventToServer('lodReady', {});
}

/*
    INIT EVERYTHING
*/

//--------------------------------------------------------------------------------------------------
// Entry point called when the team select panel is created
//--------------------------------------------------------------------------------------------------
(function() {
    //$( "#mainTeamContainer" ).SetAcceptsFocus( true ); // Prevents the chat window from taking focus by default

    /*var teamsListRootNode = $( "#TeamsListRoot" );

    // Construct the panels for each team
    for ( var teamId of Game.GetAllTeamIDs() )
    {
        var teamNode = $.CreatePanel( "Panel", teamsListRootNode, "" );
        teamNode.AddClass( "team_" + teamId ); // team_1, etc.
        teamNode.SetAttributeInt( "team_id", teamId );
        teamNode.BLoadLayout( "file://{resources}/layout/custom_game/team_select_team.xml", false, false );

        // Add the team panel to the global list so we can get to it easily later to update it
        g_TeamPanels.push( teamNode );
    }*/

    // Grab the map's name
    var mapName = Game.GetMapInfo().map_display_name;

    // Should we use option voting?
    var useOptionVoting = false;

    // All Pick Only
    if(mapName == 'all_pick' || mapName == 'all_pick_fast' || mapName == 'mirror_draft' || mapName == 'all_random') {
        useOptionVoting = true;
    }

    // Bots
    if(mapName != 'custom_bot' && mapName != '10_vs_10') {
        $.GetContextPanel().SetHasClass('disallow_bots', true);
    }

    // Are we on a map that allocates slots for us?
    if(mapName == 'all_pick_4' || mapName == 'all_pick_6') {
        // Disable max slots voting
        $.GetContextPanel().SetHasClass('veryBasicVoting', true);
        useOptionVoting = true;
    }

    //useOptionVoting = false;

    // Apply option voting related CSS
    if(useOptionVoting) {
        // Change to option voting interface
        $.GetContextPanel().SetHasClass('option_voting_enabled', true);
    }

    // Automatically assign players to teams.
    Game.AutoAssignPlayersToTeams();

    // Sets up the picking phase
    setupPickingPhase();

    // Start updating the timer, this function will schedule itself to be called periodically
    UpdateTimer();

    // Build the options categories
    buildOptionsCategories();

    // Register a listener for the event which is brodcast when the team assignment of a player is actually assigned
    $.RegisterForUnhandledEvent( "DOTAGame_TeamPlayerListChanged", OnTeamPlayerListChanged );

    // Register a listener for the event which is broadcast whenever a player attempts to pick a team
    $.RegisterForUnhandledEvent( "DOTAGame_PlayerSelectedCustomTeam", OnPlayerSelectedTeam );

    // Hook stuff
    Game.shared.hookAndFire('phase_pregame', OnPhaseChanged);
    Game.shared.hookAndFire('options', OnOptionChanged);
    Game.shared.hookAndFire('heroes', OnHeroDataChanged);
    Game.shared.hookAndFire('flags', OnflagDataChanged);
    //Game.shared.hookAndFire('selected_heroes', OnSelectedHeroesChanged);
    Game.shared.hookAndFire('selected_attr', OnSelectedAttrChanged);
    Game.shared.hookAndFire('selected_skills', OnSelectedSkillsChanged);
    Game.shared.hookAndFire('banned', OnSkillBanned);
    Game.shared.hookAndFire('ready', OnGetReadyState);
    Game.shared.hookAndFire('random_builds', OnGetRandomBuilds);
    //Game.shared.hookAndFire('selected_random_builds', OnSelectedRandomBuildChanged);
    Game.shared.hookAndFire('draft_array', OnGetDraftArray);

    // Hook callbacks
    Game.shared.events.on('heroChanged', onSelectedHeroChanged);

    // Register for notifications
    Game.shared.registerNotifications($('#lodNotificationArea'));

    // Setup the tabs
    //setupBuilderTabs();

    // Make input boxes nicer to use
    $('#mainSelectionRoot').SetPanelEvent('onactivate', Game.shared.focusNothing);

    // Toggle the show taken abilities button to be on
    /*$('#lodToggleButton').checked = true;

    // Toggle the hero grouping button
    $('#buttonHeroGrouping').checked = true;

    // Show banned abilities by default
    $('#buttonShowBanned').checked = true;*/

    // Disable clicking on the warning timer
    $('#lodTimerWarning').hittest = false;

    // Do an initial update of the player team assignment
    OnTeamPlayerListChanged();
})();
