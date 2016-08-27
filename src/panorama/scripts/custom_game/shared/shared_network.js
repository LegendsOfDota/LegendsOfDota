"use strict";

/*
    Handles server communication
*/

// Used to make data transfer smoother
var dataHooks = {};

// When a player's selected hero changes
function onSelectedHeroesChanged(table_name, key, data) {
    // Grab data
    var playerID = data.playerID;
    var heroName = data.heroName;

    // Store the change
    Game.shared.selectedHeroes[playerID] = heroName;

    // Call the event
    Game.shared.events.trigger('heroChanged', {
        playerID: playerID,
        heroName: heroName
    });
}

// Server just sent us a draft array
function onGetDraftArray(table_name, key, data) {
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

    // The draft array was updated
    Game.shared.events.trigger('draftArrayUpdated');
}

// We got some random builds
Game.shared.allRandomSelectedBuilds = {
    hero: 0,
    build: 0
};
Game.shared.randomBuilds = null;
function onGetRandomBuilds(table_name, key, data) {
    // Does this message contain selected builds?
    if(data.selected != null) {
        onSelectedRandomBuildChanged(table_name, key, data);
        return;
    }

    // Message contains the actual random builds

    // See who's data we just got
    var playerID = data.playerID;
    if(playerID == Players.GetLocalPlayer()) {
        // It's our data!
        var builds = data.builds;

        Game.shared.randomBuilds = builds;
        Game.shared.events.trigger('randomBuildDataChanged', builds);
    }
}

function onSelectedRandomBuildChanged(table_name, key, data) {
    // See who's data we just got
    var playerID = data.playerID;

    if(playerID == Players.GetLocalPlayer()) {
        Game.shared.allRandomSelectedBuilds.hero = data.hero;
        Game.shared.allRandomSelectedBuilds.build = data.build;
        Game.shared.events.trigger('selectedRandomBuildChanged');
    }
}

// Server just sent the ready state
function onGetReadyState(table_name, key, data) {
    var readyState = data.readyState;
    var lockState = data.lockState;

    // Store it
    Game.shared.readyState = readyState;
    Game.shared.lockState = lockState;

    // Fire the event
    Game.shared.events.trigger('readyChanged', readyState);
    Game.shared.events.trigger('lockStateChanged', lockState);
}

// A ban was sent through
function onSkillBanned(table_name, key, data) {
    var heroName = data.heroName;
    var abilityName = data.abilityName;
    var playerInfo = data.playerInfo;

    if(heroName != null) {
        // Store the ban
        Game.shared.bannedHeroes[heroName] = true;

        // Recalculate filters
        Game.shared.events.trigger('heroBanned', {
            heroName: heroName
        });
    }

    if(abilityName != null) {
        // Store the ban
        Game.shared.bannedAbilities[abilityName] = true;

        // Recalculate filters
        Game.shared.events.trigger('abilityBanned', {
            abilityName: abilityName
        });
    }

    if(data.playerID != null) {
        // Someone's ban info
        if(data.playerID == Players.GetLocalPlayer()) {
            // Our banning info

            // Store new values
            Game.shared.currentHeroBans = data.currentHeroBans;
            Game.shared.currentAbilityBans = data.currentAbilityBans;

            // Recalculate
            Game.shared.events.trigger('heroBansUpdated', {
                currentHeroBans: data.currentHeroBans,
                currentAbilityBans: data.currentAbilityBans
            });
        }
    }
}

// Selected abilities has changed
function onSelectedSkillsChanged(table_name, key, data) {
    var playerID = data.playerID;

    // Store the change
    Game.shared.selectedSkills[playerID] = data.skills;

    // Fire the event
    Game.shared.events.trigger('buildChanged', {
        playerID: playerID,
        newSkills: data.skills
    });
}

// Selected primary attribute changes
function onSelectedAttrChanged(table_name, key, data) {
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
}

// Flag data has changed
function onFlagDataChanged(table_name, key, data) {
    // Flag data
    if(data.isFlagData) {
        Game.shared.flagDataInverse[key] = data.flagData;

        // Do the schedule
        if(dataHooks.OnFlagDataChanged == null) dataHooks.OnFlagDataChanged = 0;
        var myHookNumber = ++dataHooks.OnFlagDataChanged;
        $.Schedule(1, function() {
            if(dataHooks.OnFlagDataChanged == myHookNumber) {
                Game.shared.events.trigger('flagDataChanged');
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

// Hero data has changed
function onHeroDataChanged(table_name, key, data) {
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
            Game.shared.events.trigger('heroDataChanged');
            Game.shared.heroDataAvailable = true;
        }
    });
}

// An option just changed
function onOptionChanged(table_name, key, data) {
    // Store new value
    Game.shared.optionValueList[key] = data.v;

    // Push the event out
    Game.shared.events.trigger('optionsChanged', {
        key: key,
        value: data.v
    });

    // Check for allowed categories changing
    //if(key == 'lodOptionAdvancedHeroAbilities' || key == 'lodOptionAdvancedNeutralAbilities' || key == 'lodOptionAdvancedNeutralWraithNight' || key == 'lodOptionAdvancedOPAbilities') {
    if(key == 'lodOptionAdvancedHeroAbilities' || key == 'lodOptionAdvancedNeutralAbilities' || key == 'lodOptionAdvancedOPAbilities') {
        allowedCategoriesChanged();
        Game.shared.events.trigger('allowedCategoriesChanged');
    }

    // Check if it's the number of slots allowed
    if(key == 'lodOptionCommonMaxSkills' || key == 'lodOptionCommonMaxSlots' || key == 'lodOptionCommonMaxUlts') {
        Game.shared.events.trigger('maxSlotsChanged');
    }

    // Check for unique abilities changing
    if(key == 'lodOptionAdvancedUniqueSkills') {
        Game.shared.events.trigger('uniqueSkillsModeChanged');
    }
}

// Allow categories were changed
function allowedCategoriesChanged() {
    // Reset the allowed categories
    Game.shared.allowedCategories = {};

    if(Game.shared.optionValueList['lodOptionAdvancedHeroAbilities'] == 1) {
        Game.shared.allowedCategories['main'] = true;
    }

    if(Game.shared.optionValueList['lodOptionAdvancedNeutralAbilities'] == 1) {
        Game.shared.allowedCategories['neutral'] = true;
    }

    if(Game.shared.optionValueList['lodOptionAdvancedCustomSkills'] == 1) {
        Game.shared.allowedCategories['custom'] = true;
    }

    if(Game.shared.optionValueList['lodOptionAdvancedOPAbilities'] == 1) {
        Game.shared.allowedCategories['OP'] = true;
    }
}

function onPhaseChanged(table_name, key, data) {
    switch(key) {
        case 'phase':
            // Update the current phase
            Game.shared.currentPhase = data.v;

            // Run the trigger
            Game.shared.events.trigger('phaseChanged', {
                newPhase: Game.shared.currentPhase
            });
        break;

        case 'endOfTimer':
            // Store the end time
            Game.shared.endOfTimer = data.v;
        break;

        case 'activeTab':
            Game.shared.events.trigger('activeTabChanged', {
                newActiveTab: data.v
            });
        break;

        case 'freezeTimer':
            Game.shared.freezeTimer = data.v;
        break;

        case 'doneCaching':
            // No longer waiting for precache
            Game.shared.waitingForPrecache = false;
        break;

        case 'vote_counts':
            // Server just sent us vote counts

            var voteCounts = Game.shared.voteCounts;

            // Defaults
            voteCounts.banning = voteCounts.banning || {};
            voteCounts.slots = voteCounts.slots || {};
            voteCounts.voteModeFifty = voteCounts.voteModeFifty || {};
            voteCounts.voteSpeed = voteCounts.voteSpeed || {};

            Game.shared.events.trigger('voteCountsUpdated', {
                voteCounts: voteCounts
            });
        break;

        case 'premium_info':
            var playerID = Players.GetLocalPlayer();

            if(data[playerID] != null) {
                // Store if we are a premium player
                Game.shared.isPremiumPlayer = data[playerID] > 0;
                Game.shared.events.trigger('premiumStatusUpdated', {
                    isPremium: Game.shared.isPremiumPlayer
                });
            }
        break;
    }
}

/*
    Network Events - Hero Selection
*/

// Updates our selected hero
Game.shared.chooseHero = function(heroName) {
    GameEvents.SendCustomGameEventToServer('lodChooseHero', {
        heroName:heroName
    });
};

// Tries to ban a hero
Game.shared.banHero = function(heroName) {
    GameEvents.SendCustomGameEventToServer('lodBan', {
        heroName:heroName
    });
};

// Updates our selected primary attribute
Game.shared.choosePrimaryAttr = function(newAttr) {
    GameEvents.SendCustomGameEventToServer('lodChooseAttr', {
        newAttr:newAttr
    });
};

// Attempts to ban an ability
Game.shared.banAbility = function(abilityName) {
    var theSkill = abilityName;

    // Push it to the server to validate
    GameEvents.SendCustomGameEventToServer('lodBan', {
        abilityName: abilityName
    });
};

// Updates our selected abilities
Game.shared.chooseNewAbility = function(slot, abilityName) {
    var theSkill = abilityName;

    // Can't select nothing
    if(theSkill.length <= 0) return;

    // Push it to the server to validate
    GameEvents.SendCustomGameEventToServer('lodChooseAbility', {
        slot: slot,
        abilityName: abilityName
    });
};

// Swaps two slots
Game.shared.swapSlots = function(slot1, slot2) {
    // Push it to the server to validate
    GameEvents.SendCustomGameEventToServer('lodSwapSlots', {
        slot1: slot1,
        slot2: slot2
    });
};

// Do all hooks, etc
(function() {
    // Wait for game setup to fully load
    Game.shared.events.on('gameSetupLoaded', function() {
        // Listen for notifications
        GameEvents.Subscribe('lodNotification', function(data) {
            // Add a notification
            Game.shared.addNotification(data);
        });

        // Add hooks
        Game.shared.hookAndFire('selected_heroes', onSelectedHeroesChanged);
        Game.shared.hookAndFire('draft_array', onGetDraftArray);
        Game.shared.hookAndFire('random_builds', onGetRandomBuilds);
        Game.shared.hookAndFire('ready', onGetReadyState);
        Game.shared.hookAndFire('banned', onSkillBanned);
        Game.shared.hookAndFire('selected_skills', onSelectedSkillsChanged);
        Game.shared.hookAndFire('selected_attr', onSelectedAttrChanged);
        Game.shared.hookAndFire('flags', onFlagDataChanged);
        Game.shared.hookAndFire('heroes', onHeroDataChanged);
        Game.shared.hookAndFire('options', onOptionChanged);
        Game.shared.hookAndFire('phase_pregame', onPhaseChanged);
    });
})();
