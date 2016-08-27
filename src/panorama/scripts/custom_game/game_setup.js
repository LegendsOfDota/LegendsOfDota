"use strict";

// Shared stuff
var allOptions = Game.shared.allOptions;

// Hide enemy picks?
var hideEnemyPicks = false;

// The current phase we are in
var currentPhase = Game.shared.PHASE_LOADING;
var selectedPhase = Game.shared.PHASE_OPTION_SELECTION;
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

// We have not picked a hero
var pickedAHero = false;

// Focuses on nothing
Game.shared.focusNothing = function() {
    $('#mainSelectionRoot').SetFocus();
}

// Selected heroes has changed
function onSelectedHeroChanged(data) {
    // Grab data
    var playerID = data.playerID;

    // Was it an update on our local player?
    if(playerID == Players.GetLocalPlayer()) {
        // We have now picked a hero
        pickedAHero = true;
    }
}

// Random build data was changed
var allRandomBuildContainers = {};
function onRandomBuildDataChanged() {
    // Ensure we have random builds
    if(Game.shared.randomBuilds == null) return;

    // ASSUMPTION: This event will only fire ONCE!

    var builds = Game.shared.randomBuilds;

    var con = $('#allRandomBuildsContainer');

    // Empty it (dodgy, should do nothing)
    con.RemoveAndDeleteChildren();

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

// Ready state was changed
function onReadyChanged() {
    var playerIsReady = Game.shared.readyState[Players.GetLocalPlayer()] == 1;

    // Push the data, push it real, good
    $('#allRandomLockButton').visible = !playerIsReady;
    $('#reviewReadyButton').visible = !playerIsReady;
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
    Game.shared.events.trigger('takenSkillsChanged');
}

// Update the highlights
function updateAllRandomHighlights() {
    var allRandomSelectedBuilds = Game.shared.allRandomSelectedBuilds;

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

// When options were changed
function onOptionsChanged(data) {
    var key = data.key;
    var value = data.value;

    // Check if there is a mapping function available
    if(optionFieldMap[key]) {
        // Yep, run it!
        optionFieldMap[key](value);
    }

    // Check for the custom stuff
    if(key == 'lodOptionGamemode') {
        // Check if we are allowing custom settings
        allowCustomSettings = value == -1;
        $.GetContextPanel().SetHasClass('allow_custom_settings', allowCustomSettings);
        $.GetContextPanel().SetHasClass('disallow_custom_settings', !allowCustomSettings);
    }

    if(key == 'lodOptionCommonGamemode') {
        // Mirror draft options
        var showMirrorDraftOptions = value == 3 || value == 5;

        $('#option_panel_main_lodOptionMirrorHeroes').SetHasClass('showThis', showMirrorDraftOptions);
        $('#option_panel_main_lodOptionCommonMirrorHeroes').visible = showMirrorDraftOptions;
    }

    // Check for banning phase
    if(key == 'lodOptionBanningMaxBans' || key == 'lodOptionBanningMaxHeroBans' || key == 'lodOptionBanningHostBanning') {
        onMaxBansChanged();
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
        hideEnemyPicks = value == 1;
        calculateHideEnemyPicks();
    }
}

// Current phase was changed
var seenPopupMessages = {};
function onPhaseChanged() {
    // Store the change
    currentPhase = Game.shared.currentPhase;

    // Update phase classes
    Game.shared.updatePhaseCSS($.GetContextPanel());

    // Progrss to the new phase
    SetSelectedPhase(currentPhase, true);

    // Message for hosters
    if(currentPhase == Game.shared.PHASE_OPTION_SELECTION) {
        // Should we show the host message popup?
        if(!seenPopupMessages.hostWarning) {
            seenPopupMessages.hostWarning = true;
            if(Game.shared.isHost()) {
                showPopupMessage('lodHostingMessage');
            } else {
                showPopupMessage('lodHostingNoobMessage');
            }
        }
    }

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
    }

    // Update what is hidden
    calculateHideEnemyPicks();
}

// Active tab was changed
function onActiveTabChanged(data) {
    var newActiveTab = data.newActiveTab;

    for(var key in allOptionLinks) {
        // Grab reference
        var info = allOptionLinks[key];
        var optionButton = info.button;

        // Set active one
        optionButton.SetHasClass('activeHostMenu', key == newActiveTab);
    }
}

// Vote counts were updated
function onVoteCountsUpdated() {
    var voteCounts = Game.shared.voteCounts;

    // Set vote counts
    $('#voteCountNo').text = '(' + (voteCounts.banning[0] || 0) + ')';
    $('#voteCountYes').text = '(' + (voteCounts.banning[1] || 0) + ')';

    $('#voteCountFiftyNo').text = '(' + (voteCounts.voteModeFifty[0] || 0) + ')';
    $('#voteCountFiftyYes').text = '(' + (voteCounts.voteModeFifty[1] || 0) + ')';

    $('#voteCountSpeedNo').text = '(' + (voteCounts.voteSpeed[0] || 0) + ')';
    $('#voteCountSpeedYes').text = '(' + (voteCounts.voteSpeed[1] || 0) + ')';
}

// When premium status is updated
function onPremiumStatusUpdated() {
    // Update the context
    $.GetContextPanel().SetHasClass('premiumUser', Game.shared.isPremiumPlayer);
}

// Sets an option to a value
function setOption(optionName, optionValue) {
    // Ensure we are the host
    if(!Game.shared.isHost()) return;

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
    } else {
        newPlayerPanel.SetParent(panel);
        newPlayerPanel.visible = true;
    }

    // Add this panel to the list of panels we've generated
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
    } else {
        newPlayerPanel.SetParent(reviewContainer);
        newPlayerPanel.visible = true;
    }

    newPlayerPanel.setShouldBeSmall(shouldMakeSmall);

    // Add this panel to the list of panels we've generated
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
                if(Game.shared.isHost()) {
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

function localSetTeamsLocked(locked) {
    Game.SetTeamSelectionLocked(locked);
    $('#mainSelectionRoot').SetHasClass('teams_locked', locked);
    $('#mainSelectionRoot').SetHasClass('teams_unlocked', !locked);
}

// Player presses auto assign
function onAutoAssignPressed() {
    // Auto assign teams
    Game.AutoAssignPlayersToTeams();

    // Lock teams
    localSetTeamsLocked(true);
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
    localSetTeamsLocked(true);
}

// Player presses unlock teams
function onUnlockPressed() {
    // Unlock Teams
    localSetTeamsLocked(false);
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

// Recalculates how many abilities / heroes we can ban
function recalculateBanLimits() {
    var maxHeroBans = Game.shared.optionValueList['lodOptionBanningMaxHeroBans'] || 0;
    var maxAbilityBans = Game.shared.optionValueList['lodOptionBanningMaxBans'] || 0;
    var hostBanning = Game.shared.optionValueList['lodOptionBanningHostBanning'] || 0;

    // Push the text
    Game.shared.events.trigger('maxBansChanged', {
        maxHeroBans: maxHeroBans,
        maxAbilityBans: maxAbilityBans,
        hostBanning: hostBanning
    });
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
    Game.shared.selectedPhase = newPhase;

    // Update CSS
    Game.shared.updateSelectedCSS($.GetContextPanel());

    // Fire the event
    Game.shared.events.trigger('selectedPhaseChanged', {
        newPhase: selectedPhase
    });
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
        var timeLeft = Math.ceil(Game.shared.endOfTimer - currentTime);

        // Freeze timer
        if(Game.shared.freezeTimer != -1) {
            timeLeft = Game.shared.freezeTimer;
        }

        // Place the text
        placeInto.text = '(' + getFancyTime(timeLeft) + ')';

        // Text to show in the timer
        var theTimerText = ''

        // Make it more obvious how long is left
        if(Game.shared.freezeTimer != -1) {
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
        if(currentPhase == Game.shared.PHASE_REVIEW && Game.shared.waitingForPrecache) {
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

    // Grab the answer
    var answer = choice;

    switch(category) {
        case 'banning':
            // Remove glow
            $('#optionVoteBanningNo').RemoveClass('makeThePlayerNoticeThisButton');
            $('#optionVoteBanningNo').RemoveClass('optionCurrentlySelected');

            $('#optionVoteBanningYes').RemoveClass('makeThePlayerNoticeThisButton');
            $('#optionVoteBanningYes').RemoveClass('optionCurrentlySelected');

            // Add the selection
            if(choice) {
                $('#optionVoteBanningYes').AddClass('optionCurrentlySelected');
                answer = 1;
            } else {
                $('#optionVoteBanningNo').AddClass('optionCurrentlySelected');
                answer = 0;
            }
        break;

        case 'voteModeFifty':
            // Remove glow
            $('#optionVoteModeFiftyNo').RemoveClass('makeThePlayerNoticeThisButton');
            $('#optionVoteModeFiftyNo').RemoveClass('optionCurrentlySelected');

            $('#optionVoteModeFiftyYes').RemoveClass('makeThePlayerNoticeThisButton');
            $('#optionVoteModeFiftyYes').RemoveClass('optionCurrentlySelected');

            // Add the selection
            if(choice) {
                $('#optionVoteModeFiftyYes').AddClass('optionCurrentlySelected');
                answer = 1;
            } else {
                $('#optionVoteModeFiftyNo').AddClass('optionCurrentlySelected');
                answer = 0;
            }
        break;

        case 'voteSpeed':
            // Remove glow
            $('#optionVoteSpeedNo').RemoveClass('makeThePlayerNoticeThisButton');
            $('#optionVoteSpeedNo').RemoveClass('optionCurrentlySelected');

            $('#optionVoteSpeedYes').RemoveClass('makeThePlayerNoticeThisButton');
            $('#optionVoteSpeedYes').RemoveClass('optionCurrentlySelected');

            // Add the selection
            if(choice) {
                $('#optionVoteSpeedYes').AddClass('optionCurrentlySelected');
                answer = 1;
            } else {
                $('#optionVoteSpeedNo').AddClass('optionCurrentlySelected');
                answer = 0;
            }
        break;
    }

    // Send the vote to the server
    castVote(category, answer);
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
    var pickingPhasePanel = $.CreatePanel('Panel', $('#pickingPhase'), '');
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
    $.RegisterForUnhandledEvent('DOTAGame_TeamPlayerListChanged', OnTeamPlayerListChanged);

    // Register a listener for the event which is broadcast whenever a player attempts to pick a team
    $.RegisterForUnhandledEvent('DOTAGame_PlayerSelectedCustomTeam', OnPlayerSelectedTeam);

    // Hook callbacks
    Game.shared.events.on('heroChanged', onSelectedHeroChanged);
    Game.shared.events.on('randomBuildDataChanged', onRandomBuildDataChanged);
    Game.shared.events.on('selectedRandomBuildChanged', updateAllRandomHighlights);
    Game.shared.events.on('readyChanged', onReadyChanged);
    Game.shared.events.on('heroBansUpdated', recalculateBanLimits);
    Game.shared.events.on('buildChanged', updateTakenSkills);
    Game.shared.events.on('flagDataChanged', buildFlagList);
    Game.shared.events.on('optionsChanged', onOptionsChanged);
    Game.shared.events.on('phaseChanged', onPhaseChanged);
    Game.shared.events.on('activeTabChanged', onActiveTabChanged);
    Game.shared.events.on('voteCountsUpdated', onVoteCountsUpdated);
    Game.shared.events.on('premiumStatusUpdated', onPremiumStatusUpdated);

    // Update random builds
    onRandomBuildDataChanged();

    // Register for notifications
    Game.shared.registerNotifications($('#lodNotificationArea'));

    // Make input boxes nicer to use
    $('#mainSelectionRoot').SetPanelEvent('onactivate', Game.shared.focusNothing);

    // Disable clicking on the warning timer
    $('#lodTimerWarning').hittest = false;

    // Do an initial update of the player team assignment
    OnTeamPlayerListChanged();

    // Stuff is ready, init other stuff
    Game.shared.events.trigger('gameSetupLoaded');
})();
