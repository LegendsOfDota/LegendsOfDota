local Constants = {}

-- Game Phases
Constants.PHASE_LOADING = 1             -- Waiting for players, etc
Constants.PHASE_OPTION_VOTING = 2       -- Voting for options
Constants.PHASE_OPTION_SELECTION = 3    -- Selection options
Constants.PHASE_BANNING = 4             -- Banning stuff
Constants.PHASE_SELECTION = 5           -- Selecting heroes
Constants.PHASE_DRAFTING = 6            -- Place holder for drafting mode
Constants.PHASE_RANDOM_SELECTION = 7    -- Random build selection phase (for All Random)
Constants.PHASE_REVIEW = 8              -- Review Phase
Constants.PHASE_SPAWN_HEROES = 9        -- Item picking has started, we are spawning our heroes
Constants.PHASE_ITEM_PICKING = 10       -- Item picking phase
Constants.PHASE_INGAME = 11             -- Game has started

-- Voting stuff
Constants.VOTE_COUNT_MODE_EVERYONE = 1       -- Everyone must vote yes (who votes)
Constants.VOTE_COUNT_MODE_FAIR = 2           -- 50% + 1 to pass a vote

-- EXP Needed for each level
Constants.XP_PER_LEVEL_TABLE = {
    0,-- 1
    200,-- 2
    500,-- 3
    900,-- 4
    1400,-- 5
    2000,-- 6
    2600,-- 7
    3400,-- 8
    4400,-- 9
    5400,-- 10
    6000,-- 11
    8200,-- 12
    9000,-- 13
    10400,-- 14
    11900,-- 15
    13500,-- 16
    15200,-- 17
    17000,-- 18
    18900,-- 19
    20900,-- 20
    23000,-- 21
    25200,-- 22
    27500,-- 23
    29900,-- 24
    32400, -- 25
    35000,-- 26
    37700,-- 27
    40500,-- 28
    43400,-- 29
    46400,-- 30
    49500,-- 31
    52700,-- 32
    56000,-- 33
    59400,-- 34
    62900,-- 35
    66500,-- 36
    70200,-- 37
    74000,-- 38
    77900,-- 39
    81900,-- 40
    86000,-- 41
    90200,-- 42
    94500,-- 43
    98900,-- 44
    103400,-- 45
    108000,-- 46
    112700,-- 47
    117500,-- 48
    122400,-- 49
    127400,-- 50
    132500,-- 51
    137700,-- 52
    143000,-- 53
    148400,-- 54
    153900,-- 55
    159500,-- 56
    165200,-- 57
    171000,-- 58
    176900,-- 59
    182900,-- 60
    189000,-- 61
    195200,-- 62
    201500,-- 63
    207900,-- 64
    214400,-- 65
    221000,-- 66
    227700,-- 67
    234500,-- 68
    241400,-- 69
    248400,-- 70
    255500,-- 71
    262700,-- 72
    270000,-- 73
    277400,-- 74
    284900,-- 75
    292500,-- 76
    300200,-- 77
    308000,-- 78
    315900,-- 79
    323900,-- 80
    332000,-- 81
    340200,-- 82
    348500,-- 83
    356900,-- 84
    365400,-- 85
    374000,-- 86
    382700,-- 87
    391500,-- 88
    400400,-- 89
    409400,-- 90
    418500,-- 91
    427700,-- 92
    437000,-- 93
    446400,-- 94
    455900,-- 95
    465500,-- 96
    475200,-- 97
    485000,-- 98
    494900,-- 99
    504900,-- 100
}

return Constants