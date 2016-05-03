var fs = require('fs')

// Script directories
var settings = require('./settings.json');                              // The settings file
var scriptDir = settings.scriptDir + '/';                               // The directory where dota scripts are placed
var scriptDirOut = settings.scriptDirOut;                               // The directory where our files are outputted
var resourcePath = settings.dotaDir + 'game/dota/resource/';   // The directory to read resource files from
var customDir = settings.customDir;                                     // The directory where our mods are read from, to be merged in

// Code needed to do multipliers
var spellMult = require('./spellMult.json');

// Create the output folder
if(!fs.existsSync(scriptDirOut)) fs.mkdirSync(scriptDirOut);

// Create the output folder
//if(!fs.existsSync(scriptDirOut)) fs.mkdirSync(scriptDirOut);

// Store for our custom stuff
var customAbilities = {};
var customUnits = {};
var customItems = {};
var items = {};
var abilities = {};

/*
    Prepare language files
*/

var langs = ['english', 'russian'];
var langIn = {};
var langOut = {};
var specialChar;    // Special character needed for doto encoding

// theString is the string we search for and use as a key to store in
// if theString can't be find, search using altString
// search in actual language, if that fails, search in english, if that fails, commit suicide
function generateLanguage(theString, altString, appendOnEnd) {
    // Grab a reference to english
    var english = langIn.english;

    if(appendOnEnd == null) appendOnEnd = '';

    for(var i=0; i<langs.length; ++i) {
        // Grab a language
        var lang = langs[i];
        var langFile = langIn[lang];
        var storeTo = langOut[lang];

        if(langFile[theString]) {
            storeTo[theString] = langFile[theString] + appendOnEnd;
        } else if(langFile[altString]) {
            storeTo[theString] = langFile[altString] + appendOnEnd;
        } else if(english[theString]) {
            storeTo[theString] = english[theString] + appendOnEnd;
        } else if(english[altString]) {
            storeTo[theString] = english[altString] + appendOnEnd;
        } else if(storeTo[altString]) {
            storeTo[theString] = storeTo[altString] + appendOnEnd;
        } else {
            console.log('Failed to find ' + theString);
        }

        if(!langFile[theString]) langFile[theString] = storeTo[theString];
    }
}

var generateAfter = [];
function generateLanguageAfter(theString, altString, appendOnEnd) {
    generateAfter.push([theString, altString, appendOnEnd]);
}

function clearGenerateAfter() {
    generateAfter = [];
}

// Read in our language files
function prepareLanguageFiles(next) {
    var ourData = ''+fs.readFileSync(customDir + 'addon_english.txt');
    var english = parseKV(ourData).lang.Tokens;

    specialChar = fs.readFileSync(resourcePath + 'dota_english.txt', 'utf16le').substring(0, 1);

    for(var i=0; i<langs.length; ++i) {
        // Grab a language
        var lang = langs[i];

        var data = fs.readFileSync(resourcePath + 'dota_' + lang + '.txt', 'utf16le').substring(1);

        // Load her up
        langIn[lang] = parseKV(data).lang.Tokens;
        langOut[lang] = {};

        var toUse;
        if(fs.existsSync(customDir + 'addon_' + lang + '.txt')) {
            var ourData
            if(lang == 'english') {
                ourData = ''+fs.readFileSync(customDir + 'addon_' + lang + '.txt');
            } else {
                ourData = ''+fs.readFileSync(customDir + 'addon_' + lang + '.txt', 'utf16le').substring(1);
            }

            toUse = parseKV(ourData).lang.Tokens;
        } else {
            toUse = english;
        }

        for(var key in english) {
            if(toUse[key]) {
                langOut[lang][key] = toUse[key];
            } else {
                langOut[lang][key] = english[key];
            }
        }

        for(var key in toUse) {
            // If the dota language has the ability and our addon is a warning
            if(checkForWarning(key, langIn[lang])){
                // Then add the warning to the abilities description
                addWarning(key, toUse[key], langIn[lang]);
            }else if(!langIn[lang][key]) {
                langIn[lang][key] = toUse[key];
            }
        }
    }

    console.log('Done loading languages!');

    // Run the next step if there is one
    if(next) next();
}

function checkForWarning(key, lang) {
    //Check the addon key is a warning
    if(key.substring(0,8) == "warning_"){
        var ability = "DOTA_Tooltip_ability_" + key.substring(8);
        //Check the dota language contains the ability we are adding a warning for
        if(lang[ability]){
            return true;
        }
    }
    return false;
}

function addWarning(key, value, lang) {
    var abilityDsecriptionKey = "DOTA_Tooltip_ability_" + key.substring(8) + "_Description";
    lang[abilityDsecriptionKey] += "\n" + value;
}

/*
    Generate our custom items
*/

function generateAbilityItems(next) {
    var currentID = 2000;
    var currentIDPassive = 3000;
    //var newKV = {};
    //var newKVPassive = {};
    var outputSkillIDs = '';
    var outputSkillIDsPassive = '';

    for(var itemName in items) {
        if(itemName == 'Version') continue;
        if(itemName.indexOf('recipe') != -1) continue;
        if(itemName.indexOf('winter') != -1) continue;
        if(itemName.indexOf('present') != -1) continue;
        if(itemName.indexOf('greevil') != -1) continue;
        if(itemName.indexOf('halloween') != -1) continue;
        if(itemName.indexOf('mystery') != -1) continue;
        if(itemName.indexOf('courier') != -1) continue;
        if(itemName.indexOf('tango') != -1) continue;
        if(itemName.indexOf('mango') != -1) continue;
        if(itemName.indexOf('tpscroll') != -1) continue;
        if(itemName.indexOf('ward') != -1) continue;
        if(itemName.indexOf('clarity') != -1) continue;
        if(itemName.indexOf('flask') != -1) continue;
        if(itemName.indexOf('dust') != -1) continue;
        if(itemName.indexOf('bottle') != -1) continue;
        if(itemName.indexOf('smoke') != -1) continue;
        var item = items[itemName];

        var cost = item.ItemCost;
        if(!cost) continue;

        var requiredLevel = Math.floor(cost / 500)+1;

        var store = {
            BaseClass: 'ability_datadriven',
            AbilityBehavior: item.AbilityBehavior,
            AbilityTextureName: 'lod_' + itemName,
            RequiredLevel: requiredLevel,
            MaxLevel: 1,
            OnUpgrade: {
                RunScript: {
                    ScriptFile: 'scripts/vscripts/../abilities/items.lua',
                    Function: 'init'
                }
            },
            OnSpellStart: {
                RunScript: {
                    ScriptFile: 'scripts/vscripts/../abilities/items.lua',
                    Function: 'onUse'
                }
            },
            AbilitySpecial: item.AbilitySpecial
        };

        if(item.AbilityBehavior.indexOf('DOTA_ABILITY_BEHAVIOR_UNIT_TARGET') != -1) {
            store.OnSpellStart.RunScript.Function = 'onUnitTarget';
        }

        if(item.AbilityBehavior.indexOf('DOTA_ABILITY_BEHAVIOR_POINT') != -1) {
            store.OnSpellStart.RunScript.Function = 'onPointTarget';
        }

        if(item.AbilityBehavior.indexOf('DOTA_ABILITY_BEHAVIOR_TOGGLE') != -1) {
            store.OnToggleOn = {
                RunScript: {
                    ScriptFile: 'scripts/vscripts/../abilities/items.lua',
                    Function: 'onToggle'
                }
            };

            store.OnToggleOff = {
                RunScript: {
                    ScriptFile: 'scripts/vscripts/../abilities/items.lua',
                    Function: 'onToggle'
                }
            };

            store.OnUpgrade.RunScript.Function = 'initToggle';
        }

        if(item.AbilityBehavior.indexOf('DOTA_ABILITY_BEHAVIOR_CHANNELLED') != -1) {
            store.OnSpellStart.RunScript.Function = 'onChannel';
        }

        if(item.AbilityUnitTargetType) {
            store.AbilityUnitTargetType = item.AbilityUnitTargetType;
        }

        if(item.AbilityUnitTargetTeam) {
            store.AbilityUnitTargetTeam = item.AbilityUnitTargetTeam;
        }

        if(item.AbilityManaCost) {
            store.AbilityManaCost = item.AbilityManaCost;
        }

        if(item.AbilityCastRange) {
            store.AbilityCastRange = item.AbilityCastRange
        }

        if(item.AbilityCastPoint) {
            store.AbilityCastPoint = item.AbilityCastPoint;
        }

        if(item.AbilityCooldown) {
            store.AbilityCooldown = item.AbilityCooldown;
        }

        if(item.AbilityUnitTargetFlags) {
            store.AbilityUnitTargetFlags = item.AbilityUnitTargetFlags;
        }

        if(item.AbilitySharedCooldown) {
            store.AbilitySharedCooldown = item.AbilitySharedCooldown;
        }

        if(item.AbilityChannelTime) {
            store.AbilityChannelTime = item.AbilityChannelTime;
        }

        if(item.AbilityBehavior.indexOf('DOTA_ABILITY_BEHAVIOR_PASSIVE') != -1) {
            // Passive Item
            customAbilities['lod_' + itemName] = store;
            delete store.OnSpellStart;

            // Store number
            outputSkillIDsPassive += '"lod_' + itemName+'"    "' + (currentIDPassive++) + '"\n';
        } else {
            // Active item
            customAbilities['lod_' + itemName] = store;

            // Store number
            outputSkillIDs += '"lod_' + itemName+'"    "' + (currentID++) + '"\n';
        }

        // Grab english
        var english = langIn.english;

        // Generate language for this spell
        var toAdd = [];
        for(var key in english) {
            if(key.indexOf(itemName) != -1) {
                toAdd.push(key);
            }
        }

        for(var i=0; i<toAdd.length; ++i) {
            var key = toAdd[i];
            var newStr = key.replace(itemName, 'lod_' + itemName);
            generateLanguage(newStr, key, '');
        }
    }

    fs.writeFile(scriptDirOut+'outputSkillIDs.txt', outputSkillIDs+'\n\n'+outputSkillIDsPassive, function(err) {
        if (err) throw err;

        console.log('Done skill IDs');

        // Check if there is another function to run
        if(next) next();
    });
}

/*
    Precache generator
*/

function generatePrecacheData(next) {
    // Precache generator
    fs.readFile(scriptDir+'npc_heroes.txt', function(err, rawHeroes) {
        console.log('Loading heroes...');
        var rootHeroes = parseKV(''+rawHeroes);

        var newKV = {};

        // List of heroes to ignore differs based on s1 and s2
        // In s2, no bots are supported, so we can just strip every hero
        var ignoreHeroes = {
            npc_dota_hero_techies: true,
            npc_dota_hero_gyrocopter: true
        };

        var heroes = rootHeroes.DOTAHeroes;
        for(var name in heroes) {
            if(name == 'Version') continue;
            if(name == 'npc_dota_hero_base') continue;

            var data = heroes[name];

            if(!ignoreHeroes[name]) {
                newKV[name+'_lod'] = {
                    override_hero: name,
                    AbilityLayout: 6
                }

                if(data.BotImplemented != 1) {
                    newKV[name+'_lod'].Ability1 = 'attribute_bonus';

                    for(var i=2;i<=16;++i) {
                        if(heroes[name]['Ability' + i]) {
                            newKV[name+'_lod']['Ability' + i] = '';
                        }
                    }
                }
            }

            // Check if they are melee
            if(data.AttackCapabilities == 'DOTA_UNIT_CAP_MELEE_ATTACK') {
                if(!newKV[name+'_lod']) {
                    newKV[name+'_lod'] = {
                        override_hero: name
                    }
                }

                // Give them projectile speed + model
                newKV[name+'_lod'].ProjectileSpeed = 1000
                newKV[name+'_lod'].ProjectileModel = 'luna_base_attack'
            }

            // Add ability layout = 6
            if(!newKV[name+'_lod']) {
                newKV[name+'_lod'] = {
                    override_hero: name
                }
            }
            newKV[name+'_lod'].AbilityLayout = 6;

            // Source2 precache
            customUnits['npc_precache_'+name] = {
                BaseClass: 'npc_dota_creep',
                precache: {
                    particle_folder: data.particle_folder,
                    soundfile: data.GameSoundsFile
                }
            }

            // Extra precache stuff
            if(data.precache) {
                for(var key in data.precache) {
                    customUnits['npc_precache_'+name].precache[key] = data.precache[key];
                }
            }
        }

        // Techies override prcaching
        customUnits.npc_precache_npc_dota_hero_techies.precache.model = 'models/heroes/techies/fx_techiesfx_mine.vmdl';

        // Store the hero data
        fs.writeFile(scriptDirOut+'npc_heroes_custom.txt', toKV(newKV, 'DOTAHeroes'), function(err) {
            if (err) throw err;

            console.log('Done saving custom heroes!');

            // Continue, if there is something else to run
            if(next) next();
        });
    });
}

/*
    Custom file mergers
*/

function loadItems(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(scriptDir+'items.txt', function(err, rawItems) {
        console.log('Loading items...');
        items = parseKV(''+rawItems).DOTAAbilities;

        // Continue, if there is something else to run
        if(next) next();
    });
}

function loadAbilities(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(scriptDir+'npc_abilities.txt', function(err, rawAbs) {
        console.log('Loading abilities...');
        abilities = parseKV(''+rawAbs).DOTAAbilities;

        // Continue, if there is something else to run
        if(next) next();
    });
}

function loadCustomUnits(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(customDir+'npc_units_custom.txt', function(err, rawCustomUnits) {
        console.log('Loading custom units...');
        customUnits = parseKV(''+rawCustomUnits).DOTAUnits;

        // Continue, if there is something else to run
        if(next) next();
    });
}

function loadCustomAbilities(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(customDir+'npc_abilities_custom.txt', function(err, rawCustomAbilities) {
        console.log('Loading custom abilities...');
        customAbilities = parseKV(''+rawCustomAbilities).DOTAAbilities;

        // Continue, if there is something else to run
        if(next) next();
    });
}

function loadCustomItems(next) {
    // Simply read in the file, and store into our varible
    fs.readFile(customDir+'npc_items_custom.txt', function(err, rawCustomAbilities) {
        console.log('Loading custom item...');
        customItems = parseKV(''+rawCustomAbilities).DOTAAbilities;

        // Continue, if there is something else to run
        if(next) next();
    });
}

/*
    CSP Stuff
*/

// Doubles the max levels really nicely
function doubleMaxLevels(newAb, fieldName) {
    // Grab vals
    var vals;

    try {
        vals = newAb[fieldName][0].split(' ');
    } catch(e) {
        return 1;
    }

    // Check if we have any data to work with
    if(vals.length > 1) {
        var newMaxVals = vals.length * 2;

        // If our levels are too high, just revert to the old level values
        if(newMaxVals > 8) {
            newMaxVals = vals.length;
        }

        // Workout if this is a float value, or int value
        var isFloat = false;
        for(var i=0; i<vals.length; ++i) {
            var intVal = parseInt(vals[i]);
            var floatVal = parseFloat(vals[i]);

            // We ONLY work with numbers
            if(isNaN(intVal)) return 1;

            if(floatVal > intVal) {
                isFloat = true;
                vals[i] = floatVal;
            } else {
                vals[i] = intVal;
            }
        }

        // Grab the first and last values
        var first = vals[0];
        var last = vals[vals.length - 1];

        // Workout the different between the two
        var dif = last - first;
        var avgDif = dif / (vals.length-1);

        // Calculate the new last value
        var newLast = first + avgDif * (newMaxVals-1);

        // Check the sign (cant change signs!)
        if(last > 0 && newLast < 0) {
            newLast = 0;
        }
        if(last < 0 && newLast > 0) {
            newLast = 0;
        }
        if(last == 0) {
            newLast = 0;
        }

        // Enforce any caps
        if(spellMult.double_caps[fieldName]) {
            if(Math.abs(first) > Math.abs(last)) {
                if(Math.abs(newLast) < spellMult.double_caps[fieldName]) {
                    newLast = spellMult.double_caps[fieldName];

                    // If the old value breaks our caps, assign it
                    if(newLast > last) {
                        newLast = last;
                    }
                }
            } else {
                if(Math.abs(newLast) > spellMult.double_caps[fieldName]) {
                    newLast = spellMult.double_caps[fieldName];

                    // If the old value breaks our caps, assign it
                    if(newLast < last) {
                        newLast = last;
                    }
                }
            }
        }

        // Calculate the new average different
        var newDif = newLast - first;
        var newAvgDif = newDif / (newMaxVals-1);

        // Put the new values in
        for(var i=0; i<(newMaxVals); ++i) {
            var newVal = first + newAvgDif * i;

            // Decide how to store it
            if(isFloat) {
                vals[i] = Math.round(newVal * 10) / 10;
            } else {
                vals[i] = Math.round(newVal);
            }
        }

        // Store the new vals
        newAb[fieldName] = vals.join(' ');

        return newMaxVals;
    }

    return 1;
}

var permutations = {
    vals: ['d', 5, 10, 20],
    func: function(spellName, ability, newAb, mult) {
        // Double Max Levels Mode
        if(mult == 'd') {
            var maxLevel = 1;

            for(var key in newAb) {
                if(newAb[key] != null) {
                    if(key == 'ID') continue;
                    if(key == 'AbilityType') continue;
                    if(key == 'AbilityBehavior') continue;
                    if(key == 'OnCastbar') continue;
                    if(key == 'OnLearnbar') continue;
                    if(key == 'FightRecapLevel') continue;
                    if(key == 'AbilitySharedCooldown') continue;
                    if(key == 'AbilityModifierSupportValue') continue;
                    if(key == 'AbilityModifierSupportBonus') continue;
                    if(key == 'AbilitySpecial') continue;
                    if(key == 'AbilityTextureName') continue;
                    if(key == 'BaseClass') continue;

                    // Double the max levels
                    var testMax = doubleMaxLevels(newAb, key);
                    if(testMax > maxLevel) {
                        maxLevel = testMax;
                    }
                }
            }

            if(newAb.AbilitySpecial) {
                for(var slotNum in newAb.AbilitySpecial) {
                    var slot = newAb.AbilitySpecial[slotNum];

                    for(var specialName in slot) {
                        if(specialName == 'var_type') continue;

                        // Double the max levels
                        var testMax = doubleMaxLevels(slot, specialName);
                        if(testMax > maxLevel) {
                            maxLevel = testMax;
                        }
                    }
                }
            }

            // Store the new max level
            newAb.MaxLevel = maxLevel;

            return newAb;
        }

        function divide(specialName, vals) {
            for(var i=0; i<vals.length; ++i) {
                vals[i] = parseFunction(vals[i] / mult);
            }

            return vals.join(' ');
        }

        function multiply(specialName, vals) {
            // Check if there is a max
            var max = null;
            if(spellMult.specific_max_value[specialName]) {
                max = parseFunction(spellMult.specific_max_value[specialName]);
            }
            if(spellMult.more_specific_max_value[spellName] && spellMult.more_specific_max_value[spellName][specialName]) {
                max = parseFunction(spellMult.more_specific_max_value[spellName][specialName]);
            }

            // Do the mult
            for(var i=0; i<vals.length; ++i) {
                vals[i] = parseFunction(vals[i] * mult);

                // Enfore the max
                if(max != null && vals[i] > max) {
                    vals[i] = max;
                }
            }

            return vals.join(' ');
        }

        function divide_or_multiply(specialName, valString, parseFunction) {
            var vals = valString.split(' ');

            // Convert all to floats
            for(var i=0; i<vals.length; ++i) {
                vals[i] = parseFunction(vals[i]);
            }

            // Check for specific values
            if(spellMult.fixed_value[spellName] && spellMult.fixed_value[spellName][specialName]) {
                return spellMult.fixed_value[spellName][specialName];
            }

            // Should we always divide this attribute?
            if(spellMult.force_divide[specialName]) {
                return divide(specialName, vals);
            }

            // Check if we need to multiply or divide
            if(vals.length > 1) {
                // Check if we are increasing, or decreasing
                if(Math.abs(vals[0]) > Math.abs(vals[1])) {
                    // Decreasing, divide
                    return divide(specialName, vals, parseFunction);
                } else {
                    // Increasing, multiply
                    return multiply(specialName, vals, parseFunction);
                }
            } else {
                // Only one value, assume multiply
                return multiply(specialName, vals, parseFunction);
            }
        }

        for(var key in newAb) {
            (function(key) {
                if(newAb[key] != null && !spellMult.ignore_all_normal[key] && !isNaN(parseInt(newAb[key][0]))) {
                    function divide2(vals, parseFunction) {
                        for(var i=0; i<vals.length; ++i) {
                            vals[i] = parseFunction(vals[i] / mult);
                        }

                        return vals.join(' ');
                    }

                    function multiply2(vals, parseFunction) {
                        // Do the mult
                        for(var i=0; i<vals.length; ++i) {
                            vals[i] = parseFunction(vals[i] * mult);
                        }

                        return vals.join(' ');
                    }

                    function divide_or_multiply2(valString, parseFunction) {
                        var vals = valString.split(' ');

                        // Convert all to floats
                        for(var i=0; i<vals.length; ++i) {
                            vals[i] = parseFunction(vals[i]);
                        }

                        // Check if we need to multiply or divide
                        if(vals.length > 1) {
                            // Check if we are increasing, or decreasing
                            if(Math.abs(vals[0]) > Math.abs(vals[1])) {
                                // Decreasing, divide
                                return divide2(vals, parseFunction);
                            } else {
                                // Increasing, multiply
                                return multiply2(vals, parseFunction);
                            }
                        } else {
                            // Only one value, assume multiply
                            return multiply2(vals, parseFunction);
                        }
                    }

                    // Do it
                    newAb[key] = [divide_or_multiply2(newAb[key][0], function(str) {
                        // Decide if it's a float or int
                        return parseInt(str);
                    })];
                }
            })(key);
        }

        if(ability.AbilitySpecial) {
            for(var slotNum in ability.AbilitySpecial) {
                var slot = ability.AbilitySpecial[slotNum];
                var parseFunction = parseInt;
                if(slot.var_type) {
                    if(slot.var_type == 'FIELD_FLOAT') {
                        parseFunction = function(str) {
                            var retNum = parseFloat(str);

                            retNum *= 100;
                            retNum = Math.floor(retNum);
                            retNum = retNum / 100;

                            return retNum;
                        };
                    } else if(slot.var_type != 'FIELD_INTEGER') {
                        console.log('Unknown field type: ' + slot.var_type);
                    }
                }
                for(var specialName in slot) {
                    if(specialName == 'var_type') continue;

                    // Check for ignores
                    if(spellMult.ignore_all_special[specialName]) continue;
                    if(spellMult.ignore_special[spellName] && spellMult.ignore_special[spellName][specialName]) continue;

                    var oldVal = slot[specialName][0];
                    var newVal = divide_or_multiply(specialName, oldVal, parseFunction);

                    // Did we actually change anything?
                    if(newVal != oldVal) {
                        // Store the change
                        newAb.AbilitySpecial[slotNum][specialName] = [newVal];
                    }
                }
            }
        }

        // Return the changes
        return newAb;
    }
};

// Permutate a spell
function permute(spellName, ability, storage) {
    // List of suffixes we found
    var suffixes = [];
    var appendsOnEnd = [];

    // Loop over all the things we need to apply
    for(var permNumber=0; permNumber<permutations.vals.length; permNumber++) {
        // Grab our spell value
        var spellValue = permutations.vals[permNumber];

        // Items don't need a doubled version
        if(spellValue == 'd' && (items[spellName] || items[spellName.replace('lod_', '')])) continue;
        if(spellName == 'ogre_magi_multicast_lod' && spellValue != 'd') continue;

        var newSpell = {
            BaseClass: spellName,
            AbilityType: ability.AbilityType,
            AbilityBehavior: ability.AbilityBehavior,
            AbilitySpecial: clone(ability.AbilitySpecial)
        };
        if(ability.AbilityUnitDamageType) newSpell.AbilityUnitDamageType = ability.AbilityUnitDamageType;

        // Copy over useful things
        if(ability.BaseClass) newSpell.BaseClass = ability.BaseClass;
        for(var key in ability) {
            if(!newSpell[key]) newSpell[key] = ability[key];
        }

        // Don't store the spellID
        delete newSpell.ID;

        var tempChange = permutations.func(spellName, ability, newSpell, spellValue);

        if(tempChange != null) {
            newSpell = tempChange;
        }

        // Grab the suffix
        var suffix = '_' + spellValue;

        // Store the spell
        storage[spellName + suffix] = newSpell;

        // Store suffix
        suffixes.push(suffix);

        if(spellValue != 'd') {
            appendsOnEnd.push(' x' + spellValue);
        } else {
            appendsOnEnd.push(' Doubled');
        }
    }

    // Grab english
    var english = langIn.english;

    // Generate language for this spell
    var toAdd = [];
    for(var key in english) {
        if(key.indexOf(spellName) != -1) {
            toAdd.push(key);
        }
    }

    for(var i=0; i<toAdd.length; ++i) {
        for(var j=0; j<suffixes.length; ++j) {
            var key = toAdd[i];

            var appendOnEnd = '';
            if(key.toLowerCase() == 'dota_tooltip_ability_' + spellName) {
                appendOnEnd = appendsOnEnd[j];
            }

            var suffix = suffixes[j];
            var newStr = key.replace(spellName, spellName + suffix);
            generateLanguageAfter(newStr, key, appendOnEnd);
        }
    }
}

function doCSP(next) {
    fs.readFile(scriptDir+'npc_abilities.txt', function(err, abilitesRaw) {
        // Convert into something useable
        var abs = parseKV(''+abilitesRaw).DOTAAbilities;

        // Merge in custom abilities
        for(var key in customAbilities) {
            if(key == 'Version') continue;

            // Store into our CSP file
            abs[key] = customAbilities[key];
        }

        // Merge in items
        for(var key in items) {
            abs[key] = items[key];
        }

        // Loop over all spells
        if(!settings.noPermute) {
            console.log('Beginning permutations...');

            for(var spellName in abs) {
                // Spells to simply ignore
                if(spellName == 'Version') continue;
                if(spellName == 'ability_base') continue;
                if(spellName == 'attribute_bonus') continue;
                if(spellName == 'default_attack') continue;
                if(spellName.indexOf('recipe') != -1) continue;
                if(spellName.indexOf('winter') != -1) continue;
                if(spellName.indexOf('present') != -1) continue;
                if(spellName.indexOf('greevil') != -1) continue;
                if(spellName.indexOf('halloween') != -1) continue;
                if(spellName.indexOf('mystery') != -1) continue;
                if(spellName.indexOf('courier') != -1) continue;
                if(spellName.indexOf('tango') != -1) continue;
                if(spellName.indexOf('tpscroll') != -1) continue;
                if(spellName.indexOf('ward') != -1) continue;
                if(spellName.indexOf('clarity') != -1) continue;
                if(spellName.indexOf('flask') != -1) continue;
                if(spellName.indexOf('dust') != -1) continue;
                if(spellName.indexOf('bottle') != -1) continue;
                if(spellName.indexOf('smoke') != -1) continue;
                if(spellMult.dont_parse[spellName]) continue;

                var newSpell = {};

                // Where to store the spell/item into
                var storeLocation = customAbilities;
                if(items[spellName]) {
                    storeLocation = customItems;
                }

                // Store all permutions of the spell
                permute(spellName, abs[spellName], storeLocation);
            }
        }

        // Ensure none of our generated items are buyable
        for(var key in customItems) {
            customItems[key].ItemPurchacustomAbilitiesseable = 0;
        }

        // Done with permutions
        console.log('Generating language...');

        for(var i=0; i<generateAfter.length; ++i) {
            var g = generateAfter[i];
            generateLanguage(g[0], g[1], g[2]);
        }
        clearGenerateAfter();

        // Run the next function, if it exists
        if(next) next();
    });
}

/*
    Level 1 ult stuff
*/

function doLvl1Ults(next) {
    // Allow us to disable lvl1 stuff
    if(settings.noPermute) {
        if(next) next();
        return;
    }

    console.log('Generating level 1 abilities...');

    var toStore = {};

    // Language stuff
    var english = langIn.english;

    var suffix = '_lvl1';

    var allSpells = [];

    for(var spellName in customAbilities) {
        allSpells[spellName] = true;
    }

    for(var spellName in abilities) {
        allSpells[spellName] = true;
    }

    for(var spellName in allSpells) {
        var spell = customAbilities[spellName] || abilities[spellName];
        if(!spell) continue;

        if((spell.AbilityType && spell.AbilityType[0] == 'DOTA_ABILITY_TYPE_ULTIMATE') || (spell.RequiredLevel && parseInt(spell.RequiredLevel[0]) > 1)) {
            var newSpell = {
                BaseClass: spellName,
                AbilityType: spell.AbilityType,
                AbilityBehavior: spell.AbilityBehavior,
                AbilitySpecial: clone(spell.AbilitySpecial)
            };
            if(spell.AbilityUnitDamageType) newSpell.AbilityUnitDamageType = spell.AbilityUnitDamageType;

            // Copy over useful things
            if(spell.BaseClass) newSpell.BaseClass = spell.BaseClass;
            for(var key in spell) {
                if(!newSpell[key]) newSpell[key] = spell[key];
            }

            // Don't store the spellID
            delete newSpell.ID;

            // Fixup levels
            newSpell.RequiredLevel = 1;
            newSpell.LevelsBetweenUpgrades = 2;

            // Store it
            toStore[spellName + '_lvl1'] = newSpell;

            // Generate language for this spell
            for(var key in english) {
                if(key.indexOf(spellName) != -1) {
                    var newStr = key.replace(spellName, spellName + suffix);
                    generateLanguageAfter(newStr, key, '');
                }
            }
        }
    }

    // Store them
    for(var key in toStore) {
        customAbilities[key] = toStore[key];
    }

    for(var i=0; i<generateAfter.length; ++i) {
        var g = generateAfter[i];
        generateLanguage(g[0], g[1], g[2]);
    }
    clearGenerateAfter();

    console.log('Done!');

    // Continue
    if(next) next();
}

/*
    Helper functions
*/

// Round to places decimal places
function r(value, places) {
    for(var i=0; i<places; i++) {
        value *= 10;
    }

    value = Math.round(value);

    for(var i=0; i<places; i++) {
        value /= 10;
    }

    return value;
}

function clone(x) {
   if (x === null || x === undefined)
        return x;
    if (x.clone)
        return x.clone();
    if (x.constructor == Array)
    {
        var r = [];
        for (var i=0,n=x.length; i<n; i++)
            r.push(clone(x[i]));
        return r;
    }
    if(typeof(x) == 'object') {
        var y = {};
        for(var key in x) {
            y[key] = clone(x[key]);
        }
        return y;
    }
    return x;
}

/*
Parses most of a KV file

Mostly copied from here:
https://github.com/Matheus28/KeyValue/blob/master/m28/keyvalue/KeyValue.hx
*/
var TYPE_BLOCK = 0;
function parseKV(data) {
    // Make sure we have some data to work with
    if(!data) return null;

    var tree = [{}];
    var treeType = [TYPE_BLOCK];
    var keys = [null];

    var i = 0;
    var line = 1;

    while(i < data.length) {
        var chr = data.charAt(i);

        if(chr == ' ' || chr == '\t') {
            // Ignore white space
        } else if(chr == '\n') {
            // We moved onto the next line
            line++;
            if(data.charAt(i+1) == '\r') i++;
        } else if(chr == '\r') {
            // We moved onto the next line
            line++;
            if(data.charAt(i+1) == '\n') i++;
        } else if(chr == '/') {
            if(data.charAt(i+1) == '/') {
                // We found a comment, ignore rest of the line
                while(++i < data.length) {
                    chr = data.charAt(i);

                    // Check for new line
                    if(chr == '\n') {
                        if(data.charAt(i+1) == '\r') ++i;
                        break;
                    }
                    if(chr == '\r') {
                        if(data.charAt(i+1) == '\n') ++i;
                        break;
                    }
                }

                // We are on a new line
                line++;
            }
        } else if(chr == '"') {
            var resultString = '';
            i++;

            while(i < data.length) {
                chr = data.charAt(i);
                if(chr == '"') break;

                if(chr == '\n') {
                    // We moved onto the next line
                    line++;
                    if(data.charAt(i+1) == '\r') i++;
                } else if(chr == '\r') {
                    // We moved onto the next line
                    line++;
                    if(data.charAt(i+1) == '\n') i++;
                } else if(chr == '\\') {
                    i++;
                    // Gran the mext cjaracter
                    chr = data.charAt(i);

                    // Check for escaped characters
                    switch(chr) {
                        case '\\':chr = '\\'; break;
                        case '"': chr = '"'; break;
                        case '\'': chr = '\''; break;
                        case 'n': chr = '\n'; break;
                        case 'r': chr = '\r'; break;
                        default:
                            chr = '\\';
                            i--;
                        break;
                    }
                }

                resultString += chr;
                i++;
            }

            if (i == data.length || chr == '\n' || chr == '\r') throw new Error("Unterminated string at line " + line);

            if(treeType[treeType.length - 1] == TYPE_BLOCK){
                if (keys[keys.length - 1] == null) {
                    keys[keys.length - 1] = resultString;
                }else {
                    if(tree[tree.length - 1][keys[keys.length - 1]] == null) {
                        tree[tree.length - 1][keys[keys.length - 1]] = [];
                    }
                    tree[tree.length - 1][keys[keys.length - 1]].push(resultString);
                    keys[keys.length - 1] = null;
                }
            }

            // Check if we need to reparse the character that ended this string
            if(chr != '"') --i;
        } else if(chr == '{') {
            if(treeType[treeType.length - 1] == TYPE_BLOCK){
                if (keys[keys.length - 1] == null) {
                    throw new Error("A block needs a key at line " + line + " (offset " + i + ")");
                }
            }

            tree.push({});
            treeType.push(TYPE_BLOCK);
            keys.push(null);
        } else if (chr == '}') {
            if (tree.length == 1) {
                throw new Error("Mismatching bracket at line " + line + " (offset " + i + ")");
            }
            if (treeType.pop() != TYPE_BLOCK) {
                throw new Error("Mismatching brackets at line " + line + " (offset " + i + ")");
            }
            keys.pop();
            var obj = tree.pop();

            if(treeType[treeType.length - 1] == TYPE_BLOCK){
                tree[tree.length - 1][keys[keys.length - 1]] = obj;
                keys[keys.length - 1] = null;
            }else {
                tree[tree.length - 1].push(obj);
            }
        } else {
            console.log("Unexpected character \"" + chr + "\" at line " + line + " (offset " + i + ")");

            // Skip to next line
            while(++i < data.length) {
                chr = data.charAt(i);

                // Check for new line
                if(chr == '\n') {
                    if(data.charAt(i+1) == '\r') ++i;
                    break;
                }
                if(chr == '\r') {
                    if(data.charAt(i+1) == '\n') ++i;
                    break;
                }
            }

            // We are on a new line
            line++;

            // Move onto the next char
            i++;
        }

        i++;
    }

    if (tree.length != 1) {
        throw new Error("Missing brackets");
    }

    return tree[0];
}

function escapeString(str) {
    return str.replace(/\\/gm, '\\\\').replace(/\"/gm, '\\"').replace(/(\r\n|\n|\r|\n\r)/gm, '\\n');
}

function toKV(obj, key) {
    var myStr = '';

    if(obj == null) {
        // Nothing to return
        return '';
    } else if (typeof obj == 'number') {
        return '"' + escapeString(key) + '""' + obj + '"';
    } else if (typeof obj == 'boolean') {
        return '"' + escapeString(key) + '""' + obj + '"';
    } else if (typeof obj == 'string') {
        return '"' + escapeString(key) + '""' + escapeString(obj) + '"';
    } else if(obj instanceof Array) {
        // An array of strings
        for(var i=0; i<obj.length; i++) {
            myStr = myStr + '"' + escapeString(key) + '" "' + escapeString(obj[i]) + '"';
        }

        return myStr;
    } else {
        // An object
        for(var entry in obj) {
            myStr += toKV(obj[entry], entry)
        }

        if(key != null) {
            return '"' + escapeString(key) + '"{\n' + myStr + '}';
        } else {
            return myStr;
        }
    }
}

/*
    Run everything
*/

// Prepare hte languge files
prepareLanguageFiles(function() {
    // Load our custom units
    loadCustomUnits(function() {
        // Load abilities
        loadAbilities(function() {
            // Load items
            loadItems(function() {
                // Load our custom items
                loadCustomItems(function() {
                    // Load our custom abilities
                    loadCustomAbilities(function() {
                        // Generate the custom item abilities
                        generateAbilityItems(function() {
                            // Generate our precache data
                            generatePrecacheData(function() {
                                doCSP(function() {
                                    doLvl1Ults(function() {
                                        // Output language files
                                        for(var i=0; i<langs.length; ++i) {
                                            (function(lang) {
                                                fs.writeFile(scriptDirOut+'addon_' + lang + '.txt', specialChar + toKV({Tokens: langOut[lang]}, 'lang'), 'utf16le', function(err) {
                                                    if (err) throw err;

                                                    console.log('Finished saving ' + lang + '!');
                                                });
                                            })(langs[i]);
                                        }

                                        // Output custom files

                                        fs.writeFile(scriptDirOut+'npc_abilities_custom.txt', toKV(customAbilities, 'DOTAAbilities'), function(err) {
                                            if (err) throw err;

                                            console.log('Done saving custom abilities file!');
                                        });

                                        fs.writeFile(scriptDirOut+'npc_items_custom.txt', toKV(customItems, 'DOTAAbilities'), function(err) {
                                            if (err) throw err;

                                            console.log('Done saving custom items file!');
                                        });

                                        fs.writeFile(scriptDirOut+'npc_units_custom.txt', toKV(customUnits, 'DOTAUnits'), function(err) {
                                            if (err) throw err;

                                            console.log('Done saving custom units file!');
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
