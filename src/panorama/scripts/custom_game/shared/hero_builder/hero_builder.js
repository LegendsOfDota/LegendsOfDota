"use strict";

// Used to hook when players are clicking around
var onLoadTabHook = {};

// Should we show banned / disallowed skills?
var showBannedSkills = true;
var showDisallowedSkills = false;
var showTakenSkills = true;
var showNonDraftSkills = false;
var useSmartGrouping = true;

// Will contain a table of all selected heroes
var allSelectedHeroes = {};

// List of hero panels
var heroPanelMap = {};

// Current hero & Skill
var currentSelectedHero = '';
var currentSelectedSkill = '';
var currentSelectedSlot = -1;
var currentSelectedAbCon = null;

// Used to calculate filters (stub function)
var calculateFilters = function(){};
var calculateHeroFilters = function(){};

// Called when the current phase changed
function onPhaseChanged() {

}

// Hooks a tab change
function hookTabChange(tabName, callback) {
    onLoadTabHook[tabName] = callback;
}

// Sets up the hero builder tab
function setupBuilderTabs() {
    var mainPanel = $('#pickingPhaseTabs');
    $.Each(mainPanel.Children(), function(panelTab) {
        if(panelTab.BHasClass('pickingPhaseTab')) {
            $.Each(panelTab.Children(), function(tabElement) {
                var tabLink = tabElement.GetAttributeString('link', '-1');

                if(tabLink != '-1') {
                    tabElement.SetPanelEvent('onactivate', function() {
                        showBuilderTab(tabLink);

                        // No skills selected anymore
                        setSelectedDropAbility();

                        // Focus to nothing
                        Game.shared.focusNothing();
                    });
                }
            });
        }
    });

    var mainContentPanel = $('#pickingPhaseTabsContent');
    $.Each(mainContentPanel.Children(), function(panelTab) {
        if(panelTab.BHasClass('pickingPhaseTabContent')) {
            panelTab.visible = false;
        }
    });

    // Show the main tab only
    showBuilderTab('pickingPhaseMainTab');

    // Default to no selected preview hero
    setSelectedHelperHero();

    for(var i=1;i<=6; ++i) {
        (function(con, slotID) {
            // Hook abilitys that should show info
            Game.shared.hookSkillInfo(con);

            con.SetDraggable(true);

            // Allow for dropping
            $.RegisterEventHandler('DragEnter', con, function(panelID, draggedPanel) {
                // Are we dragging an ability?
                if(draggedPanel.GetAttributeString('abilityname', '') != '') {
                    con.AddClass('potential_drop_target');
                    draggedPanel.SetAttributeInt('activeSlot', slotID);
                }
            });

            $.RegisterEventHandler('DragLeave', con, function(panelID, draggedPanel) {
                $.Schedule(0.1, function() {
                    con.RemoveClass('potential_drop_target');

                    if(draggedPanel.deleted == null && draggedPanel.GetAttributeInt('activeSlot', -1) == slotID) {
                        draggedPanel.SetAttributeInt('activeSlot', -1);
                    }
                });
            });

            // TODO: Allow for slot swapping
            $.RegisterEventHandler('DragStart', con, function(panelID, dragCallbacks) {
                var abName = con.GetAttributeString('abilityname', '');

                if(abName == null || abName.length <= 0) return false;

                //setSelectedDropAbility(abName, con);

                // Create a temp image to drag around
                var displayPanel = $.CreatePanel('DOTAAbilityImage', $.GetContextPanel(), 'dragImage');
                displayPanel.abilityname = abName;
                dragCallbacks.displayPanel = displayPanel;
                dragCallbacks.offsetX = 0;
                dragCallbacks.offsetY = 0;
                displayPanel.SetAttributeString('abilityname', abName);

                // Select this slot
                currentSelectedSlot = slotID;

                // Do the highlight
                highlightDropSlots();

                // Hide skill info
                $.DispatchEvent('DOTAHideAbilityTooltip');
                $.DispatchEvent('DOTAHideTitleTextTooltip');
            });

            $.RegisterEventHandler('DragEnd', con, function(panelId, draggedPanel) {
                // Delete the draggable panel
                draggedPanel.deleted = true;
                draggedPanel.DeleteAsync(0.0);

                var dropSlot = draggedPanel.GetAttributeInt('activeSlot', -1);
                if(dropSlot != -1 && dropSlot != slotID) {
                    Game.shared.swapSlots(dropSlot, slotID);
                }

                // Highlight nothing
                setSelectedDropAbility();
            });
        })($('#lodYourAbility' + i), i);
    }

    var hookSkillInfo = Game.shared.hookSkillInfo;
    var makeSkillSelectable = Game.shared.makeSkillSelectable;

    for(var i=1;i<=16; ++i) {
        hookSkillInfo($('#buildingHelperHeroPreviewSkill' + i));
        makeSkillSelectable($('#buildingHelperHeroPreviewSkill' + i));
    }

    // Hook drag and drop stuff for heroes
    var heroDragEnter = function(panelID, draggedPanel) {
        // Are we dragging an ability?
        if(draggedPanel.GetAttributeString('heroName', '') != '') {
            heroDropCon.AddClass('potential_drop_target');
            heroDropConBlank.AddClass('potential_drop_target');
            draggedPanel.SetAttributeInt('canSelectHero', 1);
        }
    };

    var heroDragLeave = function(panelID, draggedPanel) {
        $.Schedule(0.1, function() {
            heroDropCon.RemoveClass('potential_drop_target');
            heroDropConBlank.RemoveClass('potential_drop_target');

            if(draggedPanel.deleted == null) {
                draggedPanel.SetAttributeInt('canSelectHero', 0);
            }
        });
    };

    var heroDropCon = $('#pickingPhaseSelectedHeroImage');
    $.RegisterEventHandler('DragEnter', heroDropCon, heroDragEnter);
    $.RegisterEventHandler('DragLeave', heroDropCon, heroDragLeave);

    // Display info about the hero on hover
    Game.shared.hookHeroInfo(heroDropCon);

    var heroDropConBlank = $('#pickingPhaseSelectedHeroImageNone');
    $.RegisterEventHandler('DragEnter', heroDropConBlank, heroDragEnter);
    $.RegisterEventHandler('DragLeave', heroDropConBlank, heroDragLeave);

    $('#pickingPhaseSelectedHeroText').hittest = false;

    // Hook banning
    //var theSet = '';
    var hookSet = function(setName) {
        var enterNumber = 0;
        var banningArea = $('#pickingPhaseBans');

        var banningDragEnter = function(panelID, draggedPanel) {
            banningArea.AddClass('potential_drop_target');
            draggedPanel.SetAttributeInt('banThis', 1);

            // Prevent annoyingness
            ++enterNumber;
        };

        var banningDragLeave = function(panelID, draggedPanel) {
            var myNumber = ++enterNumber;

            $.Schedule(0.1, function() {
                if(myNumber == enterNumber) {
                    banningArea.RemoveClass('potential_drop_target');

                    if(draggedPanel.deleted == null) {
                        draggedPanel.SetAttributeInt('banThis', 0);
                    }
                }
            });
        };

        $.RegisterEventHandler('DragEnter', $(setName), banningDragEnter);
        $.RegisterEventHandler('DragLeave', $(setName), banningDragLeave);
    };

    hookSet('#pickingPhaseBans');
}

function showBuilderTab(tabName) {
    // Hide all panels
    var mainPanel = $('#pickingPhaseTabs');
    $.Each(mainPanel.Children(), function(panelTab) {
        panelTab.visible = false;
    });

    var mainContentPanel = $('#pickingPhaseTabsContent');
    $.Each(mainContentPanel.Children(), function(panelTab) {
        panelTab.visible = false;
    });

    // Show our tab
    var ourTab = $('#' + tabName);
    if(ourTab != null) ourTab.visible = true;

    // Try to move the hero preview
    var heroPreview = $('#buildingHelperHeroPreview');
    var heroPreviewCon = $('#' + tabName + 'HeroPreview');
    if(heroPreviewCon != null) {
        heroPreview.SetParent(heroPreviewCon);
    }

    var ourTabContent = $('#' + tabName + 'Content');
    if(ourTabContent != null) ourTabContent.visible = true;

    // Process hooks
    if(onLoadTabHook[tabName]) {
        onLoadTabHook[tabName](tabName);
    }
}

/*
    HELPER FUNCTIONS
*/

// Updates some of the filters ready for skill filtering
function prepareFilterInfo() {
    // Check on unique skills mode
    uniqueSkillsMode = Game.shared.optionValueList['lodOptionAdvancedUniqueSkills'] || 0;

    // Grab what to search for
    searchParts = searchText.split(/\s/g);
}

// Adds a build to the main selection tab
var recBuildCounter = 0;
var recommenedBuildContainerList = [];
function addRecommendedBuild(con, hero, build, attr, title) {
    var buildCon = $.CreatePanel('Panel', con, 'recBuild_' + (++recBuildCounter));
    buildCon.BLoadLayout('file://{resources}/layout/custom_game/recommended_build.xml', false, false);
    buildCon.setBuildData(hero, build, attr, title);
    buildCon.updateFilters(getSkillFilterInfo, getHeroFilterInfo);

    // Store the container
    recommenedBuildContainerList.push(buildCon);
}

function setSelectedHelperHero(heroName, dontUnselect) {
    var previewCon = $('#buildingHelperHeroPreview');

    // Validate hero name
    if(heroName == null || heroName.length <= 0 || !heroData[heroName]) {
        previewCon.visible = false;
        return;
    }

    // Show the preview
    previewCon.visible = true;

    // Grab the info
    var info = heroData[heroName];

    // Update the hero
    $('#buildingHelperHeroPreviewHero').heroname = heroName;
    $('#buildingHelperHeroPreviewHeroName').text = $.Localize(heroName);

    // Set this as the selected one
    currentSelectedHero = heroName;

    var flagDataInverse = Game.shared.flagDataInverse;

    for(var i=1; i<=16; ++i) {
        var abName = info['Ability' + i];
        var abCon = $('#buildingHelperHeroPreviewSkill' + i);

        // Ensure it is a valid ability, and we have flag data about it
        if(abName != null && abName != '' && flagDataInverse[abName]) {
            abCon.visible = true;
            abCon.abilityname = abName;
            abCon.SetAttributeString('abilityname', abName);
        } else {
            abCon.visible = false;
        }
    }

    // Highlight drop slots correctly
    if(!dontUnselect) {
        // No abilities selected anymore
        setSelectedDropAbility();
    }

    // Update the filters for this hero
    updateHeroPreviewFilters();

    // Jump to the right tab
    //showBuilderTab('pickingPhaseHeroTab');
}

// Gets skill filter info
function getSkillFilterInfo(abilityName) {
    var shouldShow = true;
    var disallowed = false;
    var banned = false;
    var taken = false;
    var cantDraft = false;

    var cat = (Game.shared.flagDataInverse[abilityName] || {}).category;

    // Check if the category is banned
    if(!Game.shared.allowedCategories[cat]) {
        // Skill is disallowed
        disallowed = true;

        // If we should show banned skills
        if(!showDisallowedSkills) {
            shouldShow = false;
        }
    }

    // Check for bans
    if(Game.shared.bannedAbilities[abilityName]) {
        // Skill is banned
        banned = true;

        if(!showBannedSkills) {
            shouldShow = false;
        }
    }

    // Mark taken abilities
    if(Game.shared.takenAbilities[abilityName]) {
        if(uniqueSkillsMode == 1 && Game.shared.takenTeamAbilities[abilityName]) {
            // Team based unique skills
            // Skill is taken
            taken = true;

            if(!showTakenSkills) {
                shouldShow = false;
            }
        } else if(uniqueSkillsMode == 2) {
            // Global unique skills
            // Skill is taken
            taken = true;

            if(!showTakenSkills) {
                shouldShow = false;
            }
        }
    }

    // Check if the tab is active
    if(shouldShow && activeTabs[cat] == null) {
        shouldShow = false;
    }

    // Check if the search category is active
    if(shouldShow && searchCategory.length > 0) {
        if(!Game.shared.flagDataInverse[abilityName][searchCategory]) {
            shouldShow = false;
        }
    }

    // Check if hte search text is active
    if(shouldShow && searchText.length > 0) {
        var localAbName = $.Localize('DOTA_Tooltip_ability_' + abilityName).toLowerCase();
        var owningHeroName = Game.shared.abilityHeroOwner[abilityName] || '';
        var localOwningHeroName = $.Localize(owningHeroName).toLowerCase();

        for(var i=0; i<searchParts.length; ++i) {
            var prt = searchParts[i];
            if(abilityName.indexOf(prt) == -1 && localAbName.indexOf(prt) == -1 && owningHeroName.indexOf(prt) == -1 && localOwningHeroName.indexOf(prt) == -1) {
                shouldShow = false;
                break;
            }
        }
    }

    // Check draft array
    if(Game.shared.heroDraft != null) {
        if(!Game.shared.heroDraft[Game.shared.abilityHeroOwner[abilityName]]) {
            // Skill cant be drafted
            cantDraft = true;

            if(!showNonDraftSkills) {
                shouldShow = false;
            }
        }
    }

    return {
        shouldShow: shouldShow,
        disallowed: disallowed,
        banned: banned,
        taken: taken,
        cantDraft: cantDraft
    };
}

function getHeroFilterInfo(heroName) {
    var shouldShow = true;

    // Grab a local reference
    var heroDraft = Game.shared.heroDraft;
    var bannedHeroes = Game.shared.bannedHeroes;

    // Are we using a draft array?
    if(shouldShow && heroDraft != null) {
        // Is this hero in our draft array?
        if(heroDraft[heroName] == null) {
            shouldShow = false;
        }
    }

    // Filter banned heroes
    if(shouldShow && bannedHeroes[heroName]) {
        shouldShow = false;
    }

    return {
        shouldShow: shouldShow,
        takenHero: allSelectedHeroes[heroName] != null
    };
}

// Shows which heroes have been taken
function showTakenHeroes() {
    // Grab local reference
    var selectedHeroes = Game.shared.selectedHeroes;

    // Calculate which heroes are taken
    allSelectedHeroes = {};
    for(var playerID in selectedHeroes) {
        allSelectedHeroes[selectedHeroes[playerID]] = true;
    }

    // Mark them as taken
    for(var heroName in heroPanelMap) {
        var panel = heroPanelMap[heroName];
        panel.SetHasClass('takenHero', allSelectedHeroes[heroName] != null);
    }
}

// Updates the filters applied to the hero preview
function updateHeroPreviewFilters() {
    // Prepare the filter info
    prepareFilterInfo();

    // Remove any search text
    searchParts = [];

    /*for(var i=1; i<=16; ++i) {
        var abCon = $('#buildingHelperHeroPreviewSkill' + i);

        // Is it visible?
        if(abCon.visible) {
            // Grab ability name
            var abilityName = abCon.GetAttributeString('abilityname', '');

            // Grab filters
            var filterInfo = getSkillFilterInfo(abilityName);

            // Apply filters
            abCon.SetHasClass('disallowedSkill', filterInfo.disallowed);
            abCon.SetHasClass('bannedSkill', filterInfo.banned);
            abCon.SetHasClass('takenSkill', filterInfo.taken);
            abCon.SetHasClass('notDraftable', filterInfo.cantDraft);
        }
    }

    // Should we filter the hero image?
    var heroImageCon = $('#buildingHelperHeroPreviewHero');
    var heroFilterInfo = getHeroFilterInfo('npc_dota_hero_' + heroImageCon.heroname);

    heroImageCon.SetHasClass('should_hide_this_hero', !heroFilterInfo.shouldShow);
    heroImageCon.SetHasClass('takenHero', heroFilterInfo.takenHero);

    var heroImageText = $('#buildingHelperHeroPreviewHeroName');
    heroImageText.SetHasClass('should_hide_this_hero', !heroFilterInfo.shouldShow);
    heroImageText.SetHasClass('takenHero', heroFilterInfo.takenHero);*/
}

// Updates the filters applied to recommended builds
function updateRecommendedBuildFilters() {
    // Loop over all recommended builds
    for(var i=0; i<recommenedBuildContainerList.length; ++i) {
        // Grab the con
        var con = recommenedBuildContainerList[i];

        // Push the filter function to the con
        con.updateFilters(getSkillFilterInfo, getHeroFilterInfo);
    }
}

// Builds the hero list
function buildHeroList() {
    var strHeroes = [];
    var agiHeroes = [];
    var intHeroes = [];

    var heroData = Game.shared.heroData;

    for(var heroName in heroData) {
        var info = heroData[heroName];

        switch(info.AttributePrimary) {
            case 'DOTA_ATTRIBUTE_STRENGTH':
                strHeroes.push(heroName);
            break;

            case 'DOTA_ATTRIBUTE_AGILITY':
                agiHeroes.push(heroName);
            break;

            case 'DOTA_ATTRIBUTE_INTELLECT':
                intHeroes.push(heroName);
            break;
        }
    }

    var doInsertHeroes = function(container, heroList) {
        // Sort the hero list
        heroList.sort();

        // Grab local reference
        var makeHeroSelectable = Game.shared.makeHeroSelectable;

        // Insert it
        for(var i=0; i<heroList.length; ++i) {
            (function() {
                var heroName = heroList[i];

                // Create the panel
                var newPanel = $.CreatePanel('DOTAHeroImage', container, 'heroSelector_' + heroName);
                newPanel.SetAttributeString('heroName', heroName);
                newPanel.heroname = heroName;
                newPanel.heroimagestyle = 'portrait';

                /*newPanel.SetPanelEvent('onactivate', function() {
                    // Set the selected helper hero
                    setSelectedHelperHero(heroName);
                });*/

                // Make the hero selectable
                makeHeroSelectable(newPanel);

                // Store it
                heroPanelMap[heroName] = newPanel;
            })();
        }
    }

    // Reset the hero map
    heroPanelMap = {};

    // Insert heroes
    doInsertHeroes($('#strHeroContainer'), strHeroes);
    doInsertHeroes($('#agiHeroContainer'), agiHeroes);
    doInsertHeroes($('#intHeroContainer'), intHeroes);

    // Update which heroes are taken
    showTakenHeroes();
    updateHeroPreviewFilters();
    updateRecommendedBuildFilters();
}

// Sets the ready state
function onReadyChanged(data) {
    var playerID = Players.GetLocalPlayer();
    var playerIsReady = data[playerID] == 1;

    $('#heroBuilderLockButton').SetHasClass('makeThePlayerNoticeThisButton', !playerIsReady);
    $('#heroBuilderLockButtonBans').SetHasClass('makeThePlayerNoticeThisButton', !playerIsReady);
    $('#heroBuilderLockButtonBans').SetHasClass('hideThisButton', playerIsReady);

    // Set the text
    if(!playerIsReady) {
        $('#heroBuilderLockButtonText').text = $.Localize('lockBuild');
    } else {
        $('#heroBuilderLockButtonText').text = $.Localize('unlockBuild');
    }
}

// Our build just got updated
function onSelectedBuildChanged(data) {
    var playerID = Players.GetLocalPlayer();
    if(playerID != data.playerID) return;

    var maxSlots = Game.shared.optionValueList['lodOptionCommonMaxSlots'] || 6;
    var defaultSkill = 'life_stealer_empty_1';

    var playerID = Players.GetLocalPlayer();
    var theBuild = Game.shared.selectedSkills[playerID];

    for(var i=1; i<=maxSlots; ++i) {
        var theAb = theBuild[i] || defaultSkill;

        var ab = $('#lodYourAbility' + i);
        ab.abilityname = theAb;
        ab.SetAttributeString('abilityname', theAb);
    }
}

// Update our attribute
function onHeroAttributeChanged(data) {
    var playerID = Players.GetLocalPlayer();
    if(playerID != data.playerID) return;

    var newAttr = Game.shared.selectedAttr[playerID];

    $('#pickingPhaseSelectHeroStr').SetHasClass('selectedAttribute', newAttr == 'str');
    $('#pickingPhaseSelectHeroAgi').SetHasClass('selectedAttribute', newAttr == 'agi');
    $('#pickingPhaseSelectHeroInt').SetHasClass('selectedAttribute', newAttr == 'int');
}

// Update our selected hero
function onSelectedHeroChanged() {
    var playerID = Players.GetLocalPlayer();
    var heroName = Game.shared.selectedHeroes[playerID];

    var heroCon = $('#pickingPhaseSelectedHeroImage');
    heroCon.SetAttributeString('heroName', heroName);
    heroCon.heroname = heroName;

    $('#pickingPhaseSelectedHeroText').text = $.Localize(heroName);

    // Set it so no hero is selected
    $('#pickingPhaseSelectedHeroImageCon').SetHasClass('no_hero_selected', false);
}

// Sets the currently selected ability for dropping
function setSelectedDropAbility(abName, abcon) {
    abName = abName || '';

    // Was there a slot selected?
    if(currentSelectedSlot != -1) {
        var theSlot = currentSelectedSlot;
        currentSelectedSlot = -1;

        if(abName.length > 0) {
            // No skills are selected anymore
            setSelectedDropAbility();
            Game.shared.chooseNewAbility(theSlot, abName);
        }
        highlightDropSlots();
        return;
    }


    // Remove the highlight from the old ability icon
    if(currentSelectedAbCon != null) {
        currentSelectedAbCon.SetHasClass('lodSelected', false);
        currentSelectedAbCon = null;
    }

    if(currentSelectedSkill == abName || abName == '') {
        // Nothing selected
        currentSelectedSkill = '';

        // Update the banning skill icon
        $('#banningButtonContainer').SetHasClass('disableButton', true);
    } else {
        // Do a selection
        currentSelectedSkill = abName;
        currentSelectedAbCon = abcon;

        // Highlight ability
        if(abcon != null) {
            abcon.SetHasClass('lodSelected', true);
        }

        // Update the banning skill icon
        $('#lodBanThisSkill').abilityname = abName;
        $('#banningButtonContainer').SetHasClass('disableButton', false);
    }

    // Highlight which slots we can drop it into
    highlightDropSlots();
}

// Highlights slots for dropping
function highlightDropSlots() {
    // If no slot selected, default slots
    if(currentSelectedSlot == -1) {
        for(var i=1; i<=6; ++i) {
            var ab = $('#lodYourAbility' + i);

            ab.SetHasClass('lodSelected', false);
            ab.SetHasClass('lodSelectedDrop', false);
        }
    } else {
        for(var i=1; i<=6; ++i) {
            var ab = $('#lodYourAbility' + i);

            if(currentSelectedSlot == i) {
                ab.SetHasClass('lodSelected', true);
                ab.SetHasClass('lodSelectedDrop', false);
            } else {
                ab.SetHasClass('lodSelected', false);
                ab.SetHasClass('lodSelectedDrop', true);
            }
        }
    }

    // If no skill is selected, highlight nothing
    if(currentSelectedSkill == '') return;

    // Count the number of ultimate abiltiies
    var theCount = 0;
    var theMax = Game.shared.optionValueList['lodOptionCommonMaxUlts'];
    var isUlt = Game.shared.isUltimateAbility(currentSelectedSkill);
    var playerID = Players.GetLocalPlayer();
    if(!isUlt) {
        theMax = Game.shared.optionValueList['lodOptionCommonMaxSkills'];
    }
    var alreadyHas = false;

    // Check our build
    var ourBuild = Game.shared.selectedSkills[playerID] || {};

    for(var slotID in ourBuild) {
        var abilityName = Game.shared.selectedSkills[playerID][slotID];

        if(Game.shared.isUltimateAbility(abilityName) == isUlt) {
            ++theCount;
        }

        if(currentSelectedSkill == abilityName) {
            alreadyHas = true;
        }
    }

    var easyAdd = theCount < theMax;

    // Decide which slots can be dropped into
    for(var i=1; i<=6; ++i) {
        var ab = $('#lodYourAbility' + i);

        // Do we already have this ability?
        if(alreadyHas) {
            ab.SetHasClass('lodSelectedDrop', currentSelectedSkill == ourBuild[i]);
        } else {
            ab.SetHasClass('lodSelectedDrop', (easyAdd || (ourBuild[i] != null && isUlt == Game.shared.isUltimateAbility(ourBuild[i]))));
        }
    }
}

// They clicked on one of their ability icons
function onYourAbilityIconPressed(slot) {
    // Focus nothing
    Game.shared.focusNothing();

    // Check what action should be performed
    if(currentSelectedSkill != '') {
        // They are trying to select a new skill
        // No skills are selected anymore
        setSelectedDropAbility();
        Game.shared.chooseNewAbility(slot, currentSelectedSkill);

        // Done
        return;
    }

    // allow swapping of skills
    if(currentSelectedSlot == -1) {
        // Select this slot
        currentSelectedSlot = slot;

        // Do the highlight
        highlightDropSlots();
    } else {
        // Attempt to drop the slot

        // Is it a different slot?
        if(currentSelectedSlot == slot) {
            // Same slot, just deselect
            currentSelectedSlot = -1;

            // Do the highlight
            highlightDropSlots();
            return;
        }

        // Different slot, do the swap
        Game.shared.swapSlots(currentSelectedSlot, slot);

        // Same slot, just deselect
        currentSelectedSlot = -1;

        // Do the highlight
        highlightDropSlots();
    }
}

/*
    WHEN TABS ARE SHOWN
*/

// When the main selection tab is shown
var firstBuildTabCall = true;
function OnMainSelectionTabShown() {
    if(firstBuildTabCall) {
        // Only do this once
        firstBuildTabCall = false;

        // The  container to work with
        var con = $('#pickingPhaseRecommendedBuildContainer');

        // Grab a local reference to recommended builds
        var recommendedBuilds = Game.shared.recommendedBuilds;

        for(var i=0; i<recommendedBuilds.length; ++i) {
            var build = recommendedBuilds[i];

            addRecommendedBuild(
                con,
                build.heroName,
                build.build,
                build.attr,
                build.title
            );
        }
    }
}

// When the skill tab is shown
var firstSkillTabCall = true;
var searchText = '';
var searchCategory = '';
var activeTabs = {};
var uniqueSkillsMode = 0;
var searchParts = [];
function OnSkillTabShown(tabName) {
    if(firstSkillTabCall) {
        // Empty the skills tab
        var con = $('#pickingPhaseSkillTabContentSkills');

        // Used to provide unique handles
        var unqiueCounter = 0;

        // A store for all abilities
        var abilityStore = {};

        // TODO: Clear filters


        // Filter processor
        searchText = '';
        searchCategory = '';

        activeTabs = {
            main: true,
            //wraith: true,
            //neutral: true,
            custom: true
        };

        var heroOwnerBlocks = {};
        calculateFilters = function() {
            // Array used to sort abilities
            var toSort = [];

            // Prepare skill filters
            prepareFilterInfo();

            // Hide all hero owner blocks
            for(var heroName in heroOwnerBlocks) {
                heroOwnerBlocks[heroName].visible = false;
                heroOwnerBlocks[heroName].SetHasClass('manySkills', false);
            }

            // Grab locals to improve speed
            var isUltimateAbility = Game.shared.isUltimateAbility;
            var abilityHeroOwner = Game.shared.abilityHeroOwner;
            var abilityCustomGroups = Game.shared.abilityCustomGroups;

            // Counters for how many skills are in a block
            var heroBlockCounts = {};
            var subSorting = {};

            // Loop over all abilties
            for(var abilityName in abilityStore) {
                var ab = abilityStore[abilityName];

                if(ab != null) {
                    var filterInfo = getSkillFilterInfo(abilityName);

                    ab.visible = filterInfo.shouldShow;
                    ab.SetHasClass('disallowedSkill', filterInfo.disallowed);
                    ab.SetHasClass('bannedSkill', filterInfo.banned);
                    ab.SetHasClass('takenSkill', filterInfo.taken);
                    ab.SetHasClass('notDraftable', filterInfo.cantDraft);

                    if(filterInfo.shouldShow) {
                        if(useSmartGrouping) {
                            var theOwner = abilityHeroOwner[abilityName] || abilityCustomGroups[abilityName];

                            if(theOwner != null) {
                                // Group it
                                var groupCon = heroOwnerBlocks[theOwner];
                                if(groupCon == null) {
                                    groupCon = $.CreatePanel('Panel', con, 'group_container_' + theOwner);
                                    groupCon.SetHasClass('grouped_skills', true);

                                    // Store it
                                    heroOwnerBlocks[theOwner] = groupCon;
                                }

                                // Making the layout much nicer
                                if(heroBlockCounts[theOwner] == null) {
                                    heroBlockCounts[theOwner] = 1;
                                } else {
                                    ++heroBlockCounts[theOwner];

                                    if(heroBlockCounts[theOwner] == 2) {
                                        groupCon.SetHasClass('manySkills', true);
                                    }
                                }

                                // Set that it is an ulty
                                if(isUltimateAbility(abilityName)) {
                                    ab.SetHasClass('ultimateAbility', true);
                                }

                                abilityStore[abilityName].SetParent(groupCon);
                                groupCon.visible = true;

                                // Add it to the sort list
                                toSort.push({
                                    txt: theOwner,
                                    con: groupCon,
                                    grouped: true
                                });

                                if(subSorting[theOwner] == null) {
                                    subSorting[theOwner] = [];
                                }

                                subSorting[theOwner].push({
                                    txt: abilityName,
                                    con: ab
                                });
                            } else {
                                toSort.push({
                                    txt: abilityName,
                                    con: ab
                                });
                            }

                        } else {
                            toSort.push({
                                txt: abilityName,
                                con: ab
                            });

                            // Ensure correct parent is set
                            abilityStore[abilityName].SetParent(con);
                        }
                    }
                }
            }

            // Do the main sort
            toSort.sort(function(a, b) {
                var txtA = a.txt;
                var txtB = b.txt;

                if(a.grouped != b.grouped) {
                    if(a.grouped) return -1;
                    return 1;
                }

                if(txtA < txtB) {
                    return -1;
                } else if(txtA > txtB) {
                    return 1;
                } else {
                    return 0;
                }
            });

            for(var i=1; i<toSort.length; ++i) {
                var left = toSort[i-1];
                var right = toSort[i];

                con.MoveChildAfter(right.con, left.con);
            }

            // Do sub sorts
            for(var heroName in subSorting) {
                var sortGroup = subSorting[heroName];

                sortGroup.sort(function(a, b) {
                    var txtA = a.txt;
                    var txtB = b.txt;

                    var isUltA = isUltimateAbility(txtA);
                    var isUltB = isUltimateAbility(txtB);

                    if(isUltA & !isUltB) {
                        return 1;
                    }

                    if(!isUltA & isUltB) {
                        return -1;
                    }

                    if(txtA < txtB) {
                        return -1;
                    } else if(txtA > txtB) {
                        return 1;
                    } else {
                        return 0;
                    }
                });

                var subCon = heroOwnerBlocks[heroName];
                for(var i=1; i<sortGroup.length; ++i) {
                    var left = sortGroup[i-1];
                    var right = sortGroup[i];

                    subCon.MoveChildAfter(right.con, left.con);
                }
            }
        }

        // Hook searchbox
        Game.shared.addInputChangedEvent($('#lodSkillSearchInput'), function(newValue) {
            // Store the new text
            searchText = newValue.toLowerCase();

            // Update list of abs
            calculateFilters();
        });

        // Add input categories
        var dropdownCategories = $('#lodSkillCategoryHolder');
        dropdownCategories.RemoveAllOptions();
        dropdownCategories.SetPanelEvent('oninputsubmit', function() {
            // Update the category
            var sel = dropdownCategories.GetSelected();
            if(sel != null) {
                searchCategory = dropdownCategories.GetSelected().GetAttributeString('category', '');

                // Update the visible abilties
                calculateFilters();
            }
        });

        // Add header
        var categoryHeader = $.CreatePanel('Label', dropdownCategories, 'skillTabCategory' + (++unqiueCounter));
        categoryHeader.text = $.Localize('lod_cat_none');
        dropdownCategories.AddOption(categoryHeader);
        dropdownCategories.SetSelected('skillTabCategory' + unqiueCounter);

        // Add categories
        for(var category in Game.shared.flagData) {
            if(category == 'category') continue;

            var dropdownLabel = $.CreatePanel('Label', dropdownCategories, 'skillTabCategory' + (++unqiueCounter));
            dropdownLabel.text = $.Localize('lod_cat_' + category);
            dropdownLabel.SetAttributeString('category', category);
            dropdownCategories.AddOption(dropdownLabel);
        }


        // Start to add skills

        var makeSkillSelectable = Game.shared.makeSkillSelectable;

        for(var abName in Game.shared.flagDataInverse) {
            // Create a new scope
            (function(abName) {
                // Create the image
                var abcon = $.CreatePanel('DOTAAbilityImage', con, 'skillTabSkill' + (++unqiueCounter));
                Game.shared.hookSkillInfo(abcon);
                abcon.abilityname = abName;
                abcon.SetAttributeString('abilityname', abName);
                abcon.SetHasClass('lodMiniAbility', true);

                //abcon.SetHasClass('disallowedSkill', true);

                makeSkillSelectable(abcon);

                // Store a reference to it
                abilityStore[abName] = abcon;
            })(abName);
        }

        /*
            Add Skill Tab Buttons
        */

        var tabButtonsContainer = $('#pickingPhaseTabFilterThingo');

        // List of tabs to show
        var tabList = [
            'main',
            'neutral',
            //'wraith',
            'custom'
        ];

        // Used to store tabs to highlight them correctly
        var storedTabs = {};

        var widthStyle = Math.floor(100 / tabList.length) + '%';

        for(var i=0; i<tabList.length; ++i) {
            // New script scope!
            (function() {
                var tabName = tabList[i];
                var tabButton = $.CreatePanel('Button', tabButtonsContainer, 'tabButton_' + tabName);
                tabButton.AddClass('lodSkillTabButton');
                tabButton.style.width = widthStyle;

                if(activeTabs[tabName]) {
                    tabButton.AddClass('lodSkillTabActivated');
                }

                // Add the text
                var tabLabel = $.CreatePanel('Label', tabButton, 'tabButton_text_' + tabName);
                tabLabel.text = $.Localize('lodCategory_' + tabName);

                tabButton.SetPanelEvent('onactivate', function() {
                    // When it is activated!

                    if(GameUI.IsControlDown()) {
                        if(activeTabs[tabName]) {
                            delete activeTabs[tabName];
                        } else {
                            activeTabs[tabName] = true;
                        }
                    } else {
                        // Reset active tabs
                        activeTabs = {};
                        activeTabs[tabName] = true;
                    }

                    // Fix highlights
                    for(var theTabName in storedTabs) {
                        var theTab = storedTabs[theTabName];
                        theTab.SetHasClass('lodSkillTabActivated', activeTabs[theTabName] == true);
                    }

                    // Recalculate which skills should be shown
                    calculateFilters();
                });

                // Store it
                storedTabs[tabName] = tabButton;
            })();
        }

        // Do initial calculation:
        calculateFilters();
    }

    // No longewr the first call
    firstSkillTabCall = false;
}

// When the hero tab is shown
var firstHeroTabCall = true;
var heroFilterInfo = {};
function OnHeroTabShown(tabName) {
    // Only run this code once
    if(firstHeroTabCall) {
        var heroSearchText = '';

        calculateHeroFilters = function() {
            var searchParts = heroSearchText.split(/\s/g);

            for(var heroName in heroPanelMap) {
                var shouldShow = getHeroFilterInfo(heroName).shouldShow;

                // Filter by melee / ranged
                if(shouldShow && heroFilterInfo.classType) {
                    var info = heroData[heroName];
                    if(info) {
                        if(info.AttackCapabilities == 'DOTA_UNIT_CAP_MELEE_ATTACK' && heroFilterInfo.classType == 'ranged' || info.AttackCapabilities == 'DOTA_UNIT_CAP_RANGED_ATTACK' && heroFilterInfo.classType == 'melee') {
                            shouldShow = false;
                        }
                    }
                }

                // Filter by hero name
                if(shouldShow && heroSearchText.length > 0) {
                    // Check each part
                    for(var i=0; i<searchParts.length; ++i) {
                        if(heroName.indexOf(searchParts[i]) == -1 && $.Localize(heroName).toLowerCase().indexOf(searchParts[i]) == -1) {
                            shouldShow = false;
                            break;
                        }
                    }
                }

                var con = heroPanelMap[heroName];
                con.SetHasClass('should_hide_this_hero', !shouldShow);
            }
        }

        // Hook searchbox
        Game.shared.addInputChangedEvent($('#lodHeroSearchInput'), function(newValue) {
            // Store the new text
            heroSearchText = newValue.toLowerCase();

            // Update list of abs
            calculateHeroFilters();
        });

        // Calculate hero filters
        calculateHeroFilters();
    }

    // No longer the first call
    firstHeroTabCall = false;
}

/*
    Button Presses
*/

// They try to set a new hero
function onNewHeroSelected() {
    // Push data to the server
    Game.shared.chooseHero(currentSelectedHero);

    // Unselect selected skill
    pickingPhasePanel.setSelectedDropAbility();
}

// They try to ban a hero
function onHeroBanButtonPressed() {
    Game.shared.banHero(currentSelectedHero);
}

// They tried to set a new primary attribute
function setPrimaryAttr(newAttr) {
    Game.shared.choosePrimaryAttr(newAttr);
}

// They click on the banning button
function onBanButtonPressed() {
    // Focus nothing
    Game.shared.focusNothing();

    // Check what action should be performed
    if(currentSelectedSkill != '') {
        // They are trying to select a new skill
        setSelectedDropAbility();
        Game.shared.banAbility(currentSelectedSkill);

        // Done
        return;
    }
}

function toggleHeroGrouping() {
    useSmartGrouping = !useSmartGrouping;

    // Update filters
    calculateFilters();
}

function toggleShowBanned() {
    showBannedSkills = !showBannedSkills;

    // Update filters
    calculateFilters();
}

function toggleShowDisallowed() {
    showDisallowedSkills = !showDisallowedSkills;

    // Update filters
    calculateFilters();
}

function toggleShowTaken() {
    showTakenSkills = !showTakenSkills;

    // Update filters
    calculateFilters();
}

function toggleShowDraftSkills() {
    showNonDraftSkills = !showNonDraftSkills;

    // Update filters
    calculateFilters();
}

// When the lock build button is pressed
function onLockBuildButtonPressed() {
    // Tell the server we clicked it
    GameEvents.SendCustomGameEventToServer('lodReady', {});
}

/*
    GENERAL EXPORTS
*/

function setMaxBans(maxBansTxt) {
    // Set the text
    $('#lodBanLimits').text = maxBansTxt;
}

// An ability was clicked
function onAbilityClicked(data) {
    var abName = data.abName;
    var abcon = data.abcon;

    // Handle the event
    setSelectedDropAbility(abName, abcon);
}

// When no Ability was clicked
function onNoAbilityClicked() {
    // Handle the event
    setSelectedDropAbility();
}

// A hero was clicked
function onHeroClicked(data) {
    var heroName = data.heroName;
    var dontUnselect = data.dontUnselect;

    // Handle the event
    setSelectedHelperHero(heroName, dontUnselect);
}

// When we start dragging an ability
function onDragAbilityStart() {
    $('#pickingPhaseBans').SetHasClass('lodSelectedDrop', true);
}

// When we stop dragging an ability
function onDragAbilityEnd() {
    $('#pickingPhaseBans').SetHasClass('lodSelectedDrop', false)
}

// When we start dragging a hero
function onDragHeroStart() {
    // Highlight drop cell
    $('#pickingPhaseSelectedHeroImage').SetHasClass('lodSelectedDrop', true)
    $('#pickingPhaseSelectedHeroImageNone').SetHasClass('lodSelectedDrop', true)

    // Banning
    $('#pickingPhaseBans').SetHasClass('lodSelectedDrop', true)
}

// When we stop dragging a hero
function onDragHeroEnd() {
    // Highlight drop cell
    $('#pickingPhaseSelectedHeroImage').SetHasClass('lodSelectedDrop', false);
    $('#pickingPhaseSelectedHeroImageNone').SetHasClass('lodSelectedDrop', false);

    // Banning
    $('#pickingPhaseBans').SetHasClass('lodSelectedDrop', false);
}

// When the draft array is updated
function onDraftArrayUpdated() {
    // Show the button to show non-draft abilities
    $('#toggleShowDraftAblilities').visible = true;
}

/*
    INIT EVERYTHING
*/

// When the panel loads
(function() {
    // Grab the root panel
    var masterRoot = $.GetContextPanel();

    // Define exports
    masterRoot.onPhaseChanged = onPhaseChanged;
    masterRoot.setMaxBans = setMaxBans;
    masterRoot.updateHeroPreviewFilters = updateHeroPreviewFilters;
    masterRoot.updateRecommendedBuildFilters = updateRecommendedBuildFilters;
    masterRoot.calculateHeroFilters = calculateHeroFilters;
    masterRoot.calculateFilters = calculateFilters;
    masterRoot.showTakenHeroes = showTakenHeroes;
    masterRoot.setSelectedHelperHero = setSelectedHelperHero;
    masterRoot.buildHeroList = buildHeroList;
    //masterRoot.setReadyState = setReadyState;
    //masterRoot.onHeroBuildUpdated = onHeroBuildUpdated;
    //masterRoot.onHeroAttributeChanged = onHeroAttributeChanged;
    //masterRoot.onSelectedHeroChanged = onSelectedHeroChanged;

    // Register for events
    Game.shared.events.on('heroChanged', onSelectedHeroChanged);
    Game.shared.events.on('buildChanged', onSelectedBuildChanged);
    Game.shared.events.on('attrChanged', onHeroAttributeChanged);
    Game.shared.events.on('readyChanged', onReadyChanged);
    Game.shared.events.on('clickAbility', onAbilityClicked);
    Game.shared.events.on('clickNoAbility', onNoAbilityClicked);
    Game.shared.events.on('clickHero', onHeroClicked);
    Game.shared.events.on('draftArrayUpdated', onDraftArrayUpdated);

    Game.shared.events.on('dragAbilityStart', onDragAbilityStart);
    Game.shared.events.on('dragAbilityEnd', onDragAbilityEnd);

    Game.shared.events.on('dragHeroStart', onDragHeroStart);
    Game.shared.events.on('dragHeroEnd', onDragHeroEnd);

    // Hook tab changes
    hookTabChange('pickingPhaseHeroTab', OnHeroTabShown);
    hookTabChange('pickingPhaseSkillTab', OnSkillTabShown);
    hookTabChange('pickingPhaseMainTab', OnMainSelectionTabShown);

    // Setup builder tabs
    setupBuilderTabs();

    // Toggle the show taken abilities button to be on
    $('#lodToggleButton').checked = true;

    // Toggle the hero grouping button
    $('#buttonHeroGrouping').checked = true;

    // Show banned abilities by default
    $('#buttonShowBanned').checked = true;
})();
