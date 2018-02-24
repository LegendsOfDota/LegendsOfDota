// Our build number
var myBuildNumber = -1;

function setBuild(buildID, heroName, build) {
    $('#allRandomHeroImage').heroname = heroName;
    $('#allRandomHeroName').text = $.Localize(heroName);

    for(var i=1; i<=6; ++i) {
        var skillCon = $('#skill' + i);

        if(build[i]) {
            skillCon.abilityname = build[i];
            skillCon.SetAttributeString('abilityname', build[i]);
            skillCon.visible = true;

            Game.shared.hookSkillInfo(skillCon);
        } else {
            skillCon.visible = false;
        }
    }

    // Store our build number
    myBuildNumber = buildID;
}

function onSelectRandomBuild() {
    // Tell the server we are selecting a build
    GameEvents.SendCustomGameEventToServer('lodSelectAllRandomBuild', {
        buildID: myBuildNumber
    });
}

function onSelectRandomHero() {
    // Tell the server we are selecting a build
    GameEvents.SendCustomGameEventToServer('lodSelectAllRandomBuild', {
        buildID: myBuildNumber,
        heroOnly: 1
    });
}

function hook(hookSkillInfo) {
    for(var i=1; i<=6; ++i) {
        hookSkillInfo($('#skill' + i));
    }
}

function setSelected(selectedHero, selectedBuild) {
    $('#selectedHeroHighlighter').SetHasClass('allRandomSelectedItem', selectedHero);
    $('#selectedBuildHighlighter').SetHasClass('allRandomSelectedItem', selectedBuild);
}

// When this panel loads
(function()
{
    // Grab the main panel
    var mainPanel = $.GetContextPanel();

    // Add the events
    mainPanel.setBuild = setBuild;
    mainPanel.hook = hook;
    mainPanel.setSelected = setSelected;
})();
