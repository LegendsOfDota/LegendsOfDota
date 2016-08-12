// Shared variables
Game.shared.flagData = {};
Game.shared.flagDataInverse = {};

// List of banned abilities
Game.shared.bannedAbilities = {};
Game.shared.bannedHeroes = {};

// List of taken abilities
Game.shared.takenAbilities = {};
Game.shared.takenTeamAbilities = {};

// Mirror Draft stuff
Game.shared.heroDraft = null;
Game.shared.abilityDraft = null;

// Map of categories that are allowed to be picked from
Game.shared.allowedCategories = {};

// Contains a map of all selected heroes
Game.shared.selectedHeroes = {};
Game.shared.selectedAttr = {};
Game.shared.selectedSkills = {};
Game.shared.readyState = {};

// Bans
Game.shared.currentHeroBans = 0;
Game.shared.currentAbilityBans = 0;

// Hero data
Game.shared.heroData = {};
Game.shared.abilityHeroOwner = {};
Game.shared.abilityCustomGroups = {};

//--------------------------------------------------------------------------------------------------
//Generate formatted string of Hero stats from sent
//--------------------------------------------------------------------------------------------------
function heroStatsLine(lineName, value, color, color2) {
    // Ensure we have a color
    if(color == null) color = 'FFFFFF';
    if(color2 == null) color2 = '7C7C7C';

    // Create the line
    return '<font color=\'#' + color + '\'>' + $.Localize(lineName) + ':</font> <font color=\'#' + color2 + '\'>' + value + '</font><br>';
}

// Converts a string into a number with a certain number of decimal places
function stringToDecimalPlaces(numberString, places) {
    if(places == null) places = 2;
    return parseFloat(numberString).toFixed(places);
}

function generateFormattedHeroStatsString(heroName, info) {
    // Will contain hero stats
    var heroStats = '';

    // Seperator used to seperate sections
    var seperator = '<font color=\'#FFFFFF\'>_____________________________________</font><br>';

    if(info != null) {
        // Calculate how many total stats we have
        var startingAttributes = info.AttributeBaseStrength + info.AttributeBaseAgility + info.AttributeBaseIntelligence;
        var attributesPerLevel = stringToDecimalPlaces(info.AttributeStrengthGain + info.AttributeAgilityGain + info.AttributeIntelligenceGain);

        // Pick the colors for primary attribute
        var strColor = info.AttributePrimary == 'DOTA_ATTRIBUTE_STRENGTH' ? 'FF3939' : 'FFFFFF';
        var agiColor = info.AttributePrimary == 'DOTA_ATTRIBUTE_AGILITY' ? 'FF3939' : 'FFFFFF';
        var intColor = info.AttributePrimary == 'DOTA_ATTRIBUTE_INTELLECT' ? 'FF3939' : 'FFFFFF';

        // Calculate our stat gain
        var strGain = stringToDecimalPlaces(info.AttributeStrengthGain);
        var agiGain = stringToDecimalPlaces(info.AttributeAgilityGain);
        var intGain = stringToDecimalPlaces(info.AttributeIntelligenceGain);

        // Essentials
        heroStats += seperator;
        heroStats += heroStatsLine('heroStats_movementSpeed', info.MovementSpeed);
        heroStats += heroStatsLine('heroStats_attackRange', info.AttackRange);
        heroStats += heroStatsLine('heroStats_armor', info.ArmorPhysical);
        heroStats += heroStatsLine('heroStats_damage', info.AttackDamageMin + '-' + info.AttackDamageMax);

        // Attribute Stats
        heroStats += seperator;
        heroStats += heroStatsLine('heroStats_strength', info.AttributeBaseStrength + ' + ' + strGain, strColor);
        heroStats += heroStatsLine('heroStats_agility', info.AttributeBaseAgility + ' + ' + agiGain, agiColor);
        heroStats += heroStatsLine('heroStats_intelligence', info.AttributeBaseIntelligence + ' + ' + intGain, intColor);
        heroStats += '<br>';

        heroStats += heroStatsLine('heroStats_attributes_starting', startingAttributes, 'F9891A');
        heroStats += heroStatsLine('heroStats_attributes_perLevel', attributesPerLevel, 'F9891A');

        // Advanced
        heroStats += seperator;
        heroStats += heroStatsLine('heroStats_attackRate', stringToDecimalPlaces(info.AttackRate));
        heroStats += heroStatsLine('heroStats_attackAnimationPoint', stringToDecimalPlaces(info.AttackAnimationPoint));
        heroStats += heroStatsLine('heroStats_turnrate', stringToDecimalPlaces(info.MovementTurnRate));

        if(stringToDecimalPlaces(info.StatusHealthRegen) != 0.25) {
            heroStats += heroStatsLine('heroStats_baseHealthRegen', stringToDecimalPlaces(info.StatusHealthRegen));
        }

        if(info.MagicalResistance != 25) {
            heroStats += heroStatsLine('heroStats_magicalResistance', info.MagicalResistance);
        }

        if(stringToDecimalPlaces(info.StatusManaRegen) != 0.01) {
            heroStats += heroStatsLine('heroStats_baseManaRegen', stringToDecimalPlaces(info.StatusManaRegen));
        }

        if(info.ProjectileSpeed != 900 && info.ProjectileSpeed != 0) {
            heroStats += heroStatsLine('heroStats_projectileSpeed', info.ProjectileSpeed);
        }

        if(info.VisionDaytimeRange != 1800) {
            heroStats += heroStatsLine('heroStats_visionDay', info.VisionDaytimeRange);
        }

        if(info.VisionNighttimeRange != 800) {
            heroStats += heroStatsLine('heroStats_visionNight', info.VisionNighttimeRange);
        }

        if(info.RingRadius != 70) {
            heroStats += heroStatsLine('heroStats_ringRadius', info.RingRadius);
        }
    }

    // Unique Mechanics
    var heroMechanic = $.Localize("unique_mechanic_" + heroName.substring(14));
    if(heroMechanic != "unique_mechanic_" + heroName.substring(14)) {
        heroStats += '<br>';
        heroStats += heroStatsLine('heroStats_uniqueMechanic', heroMechanic, '23FF27', '70EA72');
    }

    return heroStats;
}

// Makes skill info appear when you hover the panel that is parsed in
Game.shared.hookSkillInfo = function(panel) {
    // Show
    panel.SetPanelEvent('onmouseover', function() {
        var ability = panel.GetAttributeString('abilityname', 'life_stealer_empty_1');

        // If no ability, give life stealer empty
        if(ability == '') {
            ability = 'life_stealer_empty_1';
        }

        $.DispatchEvent('DOTAShowAbilityTooltip', panel, ability);
    });

    // Hide
    panel.SetPanelEvent('onmouseout', function() {
        $.DispatchEvent('DOTAHideAbilityTooltip');
        $.DispatchEvent('DOTAHideTitleTextTooltip');
    });
}

Game.shared.hookHeroInfo = function(heroCon) {
    // Show hero info
    heroCon.SetPanelEvent('onmouseover', function() {
        var heroName = heroCon.GetAttributeString('heroName', '');
        var info = Game.shared.heroData[heroName];

        var displayNameTitle = $.Localize(heroName);
        var heroStats = generateFormattedHeroStatsString(heroName, info);

        // Show the tip
        $.DispatchEvent('DOTAShowTitleTextTooltipStyled', heroCon, displayNameTitle, heroStats, "testStyle");
    });

    // Hide hero info
    heroCon.SetPanelEvent('onmouseout', function() {
        $.DispatchEvent('DOTAHideAbilityTooltip');
        $.DispatchEvent('DOTAHideTitleTextTooltip');
    });
}

/*
    Drag & Drop
*/

Game.shared.makeSkillSelectable = function(abcon) {
    abcon.SetPanelEvent('onactivate', function() {
        var abName = abcon.GetAttributeString('abilityname', '');
        if(abName == null || abName.length <= 0) return false;

        // Mark it as dropable
        Game.shared.events.trigger('clickAbility', {
            abName: abName,
            abcon: abcon
        });

        // Find the owning hero
        var heroOwner = Game.shared.abilityHeroOwner[abName];
        if(heroOwner != null) {
            Game.shared.events.trigger('clickHero', {
                heroName: heroOwner,
                dontUnselect: true
            });
        }
    });

    // Make it draggable
    abcon.SetDraggable(true);

    $.RegisterEventHandler('DragStart', abcon, function(panelID, dragCallbacks) {
        var abName = abcon.GetAttributeString('abilityname', '');
        if(abName == null || abName.length <= 0) return false;

        // Select this ability
        Game.shared.events.trigger('clickAbility', {
            abName: abName,
            abcon: abcon
        });

        // Create a temp image to drag around
        var displayPanel = $.CreatePanel('DOTAAbilityImage', $.GetContextPanel(), 'dragImage');
        displayPanel.abilityname = abName;
        dragCallbacks.displayPanel = displayPanel;
        dragCallbacks.offsetX = 0;
        dragCallbacks.offsetY = 0;
        displayPanel.SetAttributeString('abilityname', abName);

        // Hide skill info
        $.DispatchEvent('DOTAHideAbilityTooltip');
        $.DispatchEvent('DOTAHideTitleTextTooltip');

        // Banning
        Game.shared.events.trigger('dragAbilityStart', {
            abName: abName,
            abcon: abcon
        });
    });

    $.RegisterEventHandler('DragEnd', abcon, function(panelId, draggedPanel) {
        // Delete the draggable panel
        draggedPanel.deleted = true;
        draggedPanel.DeleteAsync(0.0);

        var dropSlot = draggedPanel.GetAttributeInt('activeSlot', -1);
        if(dropSlot != -1) {
            var abName = draggedPanel.GetAttributeString('abilityname', '');
            if(abName != null && abName.length > 0) {
                // No skills are selected anymore
                Game.shared.chooseNewAbility(dropSlot, abName);
            }
        }

        // Highlight nothing
        Game.shared.events.trigger('clickNoAbility');

        // Are we banning a hero?
        if(draggedPanel.GetAttributeInt('banThis', 0) == 1) {
            var abName = draggedPanel.GetAttributeString('abilityname', '');
            if(abName != null && abName.length > 0) {
                // No skills are selected anymore
                //setSelectedDropAbility();
                Game.shared.banAbility(abName);
            }
        }

        // Banning
        Game.shared.events.trigger('dragAbilityEnd', {
            abName: abName,
            abcon: abcon,
            dropSlot: dropSlot
        });
    });
}

// Makes the given hero container selectable
Game.shared.makeHeroSelectable = function(heroCon) {
    heroCon.SetPanelEvent('onactivate', function() {
        var heroName = heroCon.GetAttributeString('heroName', '');
        if(heroName == null || heroName.length <= 0) return;

        Game.shared.events.trigger('clickHero', {
            heroName: heroName,
            dontUnselect: true
        });
    });

    // Make it draggable
    heroCon.SetDraggable(true);

    $.RegisterEventHandler('DragStart', heroCon, function(panelID, dragCallbacks) {
        var heroName = heroCon.GetAttributeString('heroName', '');
        if(heroName == null || heroName.length <= 0) return;

        // Create a temp image to drag around
        var displayPanel = $.CreatePanel('DOTAHeroImage', $.GetContextPanel(), 'dragImage');
        displayPanel.heroname = heroName;
        dragCallbacks.displayPanel = displayPanel;
        dragCallbacks.offsetX = 0;
        dragCallbacks.offsetY = 0;
        displayPanel.SetAttributeString('heroName', heroName);

        // Hide skill info
        $.DispatchEvent('DOTAHideAbilityTooltip');
        $.DispatchEvent('DOTAHideTitleTextTooltip');

        // Fire the event
        Game.shared.events.trigger('dragHeroStart', {
            heroName: heroName,
            heroCon: heroCon
        });
    });

    $.RegisterEventHandler('DragEnd', heroCon, function(panelId, draggedPanel) {
        // Delete the draggable panel
        draggedPanel.deleted = true;
        draggedPanel.DeleteAsync(0.0);

        var heroName = draggedPanel.GetAttributeString('heroName', '');

        // Fire the event
        Game.shared.events.trigger('dragHeroEnd', {
            heroName: heroName,
            heroCon: heroCon
        });

        if(heroName == null || heroName.length <= 0) return;

        // Can we select this as our hero?
        if(draggedPanel.GetAttributeInt('canSelectHero', 0) == 1) {
            Game.shared.chooseHero(heroName);
        }

        // Are we banning a hero?
        if(draggedPanel.GetAttributeInt('banThis', 0) == 1) {
            Game.shared.banHero(heroName);
        }
    });

    // Hook the hero info display
    Game.shared.hookHeroInfo(heroCon);
}

/*
    Skill utility
*/

// Decides if the given ability is an ult or not
Game.shared.isUltimateAbility = function(abilityName) {
    return (Game.shared.flagDataInverse[abilityName] || {}).isUlt != null;
}
