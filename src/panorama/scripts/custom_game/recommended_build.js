// Store build data to send to the server
var buildData = null;

function setBuildData(hero, build, attr, title) {
    // Push skills
    for(var slotID=1; slotID<=6; ++slotID) {
        var slot = $('#recommendedSkill' + slotID);

        // Make it selectable and show info
        Game.shared.makeSkillSelectable(slot);
        Game.shared.hookSkillInfo(slot);

        if(build[slotID]) {
            slot.visible = true;
            slot.abilityname = build[slotID];
            slot.SetAttributeString('abilityname', build[slotID]);
        } else {
            slot.visible = false;
        }
    }

    // Set hero image
    var heroImageCon = $('#recommendedHeroImage');
    heroImageCon.heroname = hero;
    heroImageCon.SetAttributeString('heroName', hero);
    Game.shared.makeHeroSelectable(heroImageCon);

    // Set the title
    var titleLabel = $('#buildName');
    if(title != null) {
        titleLabel.text = title;
        titleLabel.visible = true;
    } else {
        titleLabel.visible = false;
    }

    // Set hero attribute
    var attrImage = 'file://{images}/primary_attribute_icons/primary_attribute_icon_strength.psd';
    if(attr == 'agi') {
        attrImage = 'file://{images}/primary_attribute_icons/primary_attribute_icon_agility.psd';
    } else if(attr == 'int') {
        attrImage = 'file://{images}/primary_attribute_icons/primary_attribute_icon_intelligence.psd';
    }

    $('#recommendedAttribute').SetImage(attrImage);

    // Store the build data
    buildData = {
        hero: hero,
        attr: attr,
        build: build
    };
}

// When the build is selected
function onSelectBuildPressed() {
    // Prevent reloading issues
    if(buildData == null) return;

    // Push it to the server
    GameEvents.SendCustomGameEventToServer('lodSelectBuild', buildData);
}

// Does filtering on the abilities
function updateFilters(getSkillFilterInfo, getHeroFilterInfo) {
    if(buildData == null) return;

    // Grab the build
    var build = buildData.build;

    // Filter each ability
    for(var slotID=1; slotID<=6; ++slotID) {
        // Grab the slot
        var slot = $('#recommendedSkill' + slotID);

        // Grab the filter info
        var abilityName = build[slotID];
        var filterInfo = getSkillFilterInfo(abilityName);

        // Apply the filter info
        slot.SetHasClass('disallowedSkill', filterInfo.disallowed);
        slot.SetHasClass('bannedSkill', filterInfo.banned);
        slot.SetHasClass('takenSkill', filterInfo.taken);
        slot.SetHasClass('notDraftable', filterInfo.cantDraft);
    }

    // Update hero
    var heroFilterInfo = getHeroFilterInfo(buildData.hero);
    var heroImageCon = $('#recommendedHeroImage');
    heroImageCon.SetHasClass('should_hide_this_hero', !heroFilterInfo.shouldShow);
    heroImageCon.SetHasClass('takenHero', heroFilterInfo.takenHero);
}

// When this panel loads
(function()
{
	// Grab the main panel
	var mainPanel = $.GetContextPanel();

    // Add the events
    mainPanel.setBuildData = setBuildData;
    mainPanel.updateFilters = updateFilters;
})();
