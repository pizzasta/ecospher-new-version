// The Ghost Archive: curated signals that live in the feed before (and
// alongside) real users. They set the atmosphere, act as emotional anchors
// to reply to, and quietly demonstrate what a good signal sounds like.
// The app doesn't launch empty — it launches haunted.

export type GhostSignal = {
  id: string
  handle: string
  timeAgo: string
  content: string
  mood: 'nocturne' | 'bloom' | 'drift' | 'static' | 'lost'
  resonance: number
  anonymous: boolean
  duration: string
  waveformSeed: number
}

// [handle, timeAgo, content, mood, resonance, duration]
type GhostRow = [string, string, string, GhostSignal['mood'], number, string]

const ROWS: GhostRow[] = [
  ['rainonthecarport', '2 nights ago', 'the last time i heard rain like this, i was 12. same roof sound. different everything else.', 'nocturne', 88, '0:41'],
  ['gasstationoracle', 'a while back', 'the fluorescent hum at the gas station at 2am is the closest thing my town has to a hymn.', 'drift', 74, '0:33'],
  ['voicemailafter2', 'archived', 'i still have the voicemail. i don\'t play it. i just check that it\'s there.', 'lost', 92, '0:19'],
  ['fridgehumat3am', 'last week', 'the refrigerator and i have an understanding. it hums, i sit on the kitchen floor, neither of us mentions it.', 'nocturne', 81, '0:52'],
  ['blurrywafflehouse', 'some tuesday', 'a stranger paid for my coffee at 4am and said "rough one, huh." i think about him more than some family.', 'bloom', 90, '0:47'],
  ['porchlightorbit', 'two summers ago', 'my neighbor leaves her porch light on for a cat that stopped coming back in 2019. so do i, kind of.', 'lost', 86, '0:38'],
  ['leftoneearbudin', 'recently', 'sharing earbuds with someone and only getting half the song. i miss hearing half of things.', 'drift', 77, '0:29'],
  ['deadbatteryangel', 'an hour that doesn\'t exist', 'my phone died mid-argument and by the time it charged neither of us remembered being angry. technology as mercy.', 'static', 69, '0:44'],
  ['cerealfordinneragain', 'tonight probably', 'cereal for dinner again. third night. the spoon against the bowl is the loudest thing in the apartment.', 'nocturne', 72, '0:26'],
  ['sprinklersatmidnight', 'every summer', 'the sprinklers come on at midnight whether anyone is watching or not. i find that almost unbearably hopeful.', 'bloom', 84, '0:36'],
  ['wrongnumberbutstayed', 'years ago', 'someone texted the wrong number and we talked for three hours anyway. never again, never knew her name.', 'drift', 95, '1:02'],
  ['grandmasashtray', 'kept', 'nobody in the house smokes anymore but the ashtray stays on the table. some objects are load-bearing.', 'lost', 89, '0:31'],
  ['mothsinthelamplight', 'most nights', 'the moths keep choosing the porch light over the moon. i get it. the moon never answered anybody.', 'nocturne', 79, '0:40'],
  ['icecreamtruckatdusk', 'late august', 'the ice cream truck still does its route after the kids go in. just the song, slower, to no one.', 'lost', 83, '0:35'],
  ['doorbellnobodyanswered', 'once', 'i rang the doorbell of my childhood house. someone else\'s shadow moved behind the glass. i left before they opened it.', 'drift', 91, '0:49'],
  ['tvglowthroughcurtains', 'driving home', 'every blue-lit window on my street is someone not sleeping. we should start a club. no meetings. just the glow.', 'nocturne', 87, '0:42'],
  ['halfdeflatedballoon', 'after the party', 'the balloon is at that stage where it floats at exactly eye level. neither rising nor falling. relatable content.', 'static', 66, '0:21'],
  ['busstopconfession', 'a winter ago', 'told my whole situation to an old man at the bus stop because i knew i\'d never see him again. he said "you\'ll be alright." i\'m holding him to it.', 'bloom', 93, '0:58'],
  ['airconditionerchoir', 'july', 'every window unit on the block drones a slightly different note. in july the whole street is one long chord.', 'drift', 71, '0:30'],
  ['expiredcoupon', 'found today', 'found a coupon she clipped in a book. expired 2016. saved it. some debts you keep on purpose.', 'lost', 88, '0:27'],
  ['laundromatat1am', 'spin cycle', 'the laundromat at 1am is the most honest room in the city. everyone there has somewhere they\'re not.', 'nocturne', 85, '0:45'],
  ['heatlightningseason', 'horizon', 'heat lightning with no thunder. all the drama of a storm, none of the follow-through. me too, sky. me too.', 'static', 76, '0:24'],
  ['checkoutlanecrying', 'it happens', 'cried a little in the checkout lane and the cashier just slid the receipt over slow, like a note passed in class.', 'bloom', 82, '0:34'],
  ['carradiobaptism', 'on the highway', 'the exact song at the exact minute on a highway at night. the radio knows things. i don\'t ask how.', 'drift', 80, '0:39'],
  ['stairwellecho', 'between floors', 'sang one note in the parking garage stairwell to hear it come back. the building sang it better. left humbled.', 'static', 67, '0:22'],
  ['windchimeinventory', 'after the wind', 'the windchime only plays when something invisible moves through. i keep a loose inventory of the invisible now.', 'bloom', 78, '0:37'],
  ['minivangraveyard', 'past the lot', 'the dealership floodlights stay on all night over minivans nobody is coming to buy. somebody loves them. contractually.', 'lost', 64, '0:28'],
  ['frozenfoodaislezen', 'errands', 'stood in the frozen food aisle fog for a second too long. cold air, white light. closest i got to a vacation this year.', 'drift', 73, '0:32'],
  ['receiptinthewind', 'parking lot', 'a receipt blew across the parking lot like it had an appointment. godspeed, little guy. one of us should know where we\'re going.', 'static', 70, '0:25'],
  ['lastcallecho', 'closing time', 'the bartender flicked the lights and everybody\'s face did the same thing. nobody wants the night to agree to end.', 'nocturne', 84, '0:43'],
  ['glowinthedarkceiling', 'old bedroom', 'the plastic stars on my old ceiling still glow for the new kid who lives there. constellations i installed. handed down.', 'bloom', 90, '0:46'],
  ['dialtonelullaby', 'remembered', 'i miss the dial tone. an entire sound whose only job was to say: i\'m here, whenever you\'re ready.', 'lost', 87, '0:30'],
  ['mallfountainwishes', 'demolished now', 'they drained the mall fountain and scooped out the coins. somewhere, a truck full of wishes. mine was in there.', 'lost', 81, '0:36'],
  ['somebodyleftthetvon', 'down the hall', 'the tv talks to an empty couch all night in the next apartment. i\'ve started thinking of it as a roommate.', 'nocturne', 75, '0:33'],
  ['peachstreetlight', 'my corner', 'one streetlight on my block buzzes pink instead of orange. malfunctioning, technically. beautiful, technically.', 'static', 79, '0:27'],
  ['sinkfullofdishes', 'still there', 'the dishes can hear me deciding not to do them. we maintain a respectful silence about it.', 'drift', 68, '0:23'],
  ['trampolineweather', 'first warm night', 'lay on the trampoline till 2am like high school. the springs remembered my shape. embarrassing. wonderful.', 'bloom', 86, '0:48'],
  ['powerlinesatdusk', 'driving west', 'starlings on the power lines at dusk, spaced out like notes on a staff. someone should play the song. it\'s probably sad.', 'drift', 83, '0:38'],
  ['breakroomvending', 'shift change', 'the vending machine light flickers in the empty breakroom all night. devotion looks like a lot of things.', 'lost', 71, '0:26'],
  ['couchcushionarchive', 'excavated', 'found a movie stub from 2014 in the couch. cheaper times. better company. the couch keeps better records than i do.', 'lost', 85, '0:31'],
  ['nightshiftradio', '4:40am', 'the overnight radio host says "for everyone still up" like he can see us. all of us, scattered, nodding.', 'nocturne', 92, '0:51'],
  ['cassettetapeloyalty', 'glovebox', 'the car still has a tape deck and one tape. we listen to the same nine songs forever. neither of us complains.', 'drift', 77, '0:35'],
  ['screendoorsummer', 'at my aunt\'s', 'the specific slap of a screen door means summer, means someone\'s home, means dinner soon. one sound, whole world.', 'bloom', 89, '0:40'],
  ['motelhallwayhum', 'somewhere in ohio', 'every motel hallway hums the same note. i checked. it follows you from state to state like a loyal ghost.', 'static', 74, '0:29'],
  ['culdesacorbit', 'going nowhere', 'drove the cul-de-sac loop six times with the windows down. you don\'t always need a destination. sometimes just orbit.', 'drift', 76, '0:34'],
  ['juiceboxdiplomacy', 'kid logic', 'a kid at the park offered me his second juice box because i "looked thirsty in my heart." out of the mouths of babes.', 'bloom', 94, '0:42'],
  ['unpluggedlandline', 'in the closet', 'we keep the unplugged landline in the closet. mom can\'t throw out a phone her mother\'s voice once lived in.', 'lost', 91, '0:44'],
  ['parkinglotsermon', 'after close', 'the cart collector at the supermarket talks to the carts. gently. "come on now. almost home." honestly? church.', 'bloom', 80, '0:37'],
  ['overpassacoustics', 'underneath', 'under the overpass the traffic overhead sounds like surf. the city pretending to be an ocean. let it.', 'static', 72, '0:28'],
  ['nightbloomingjasmine', 'walking home', 'the jasmine only bothers to smell like that after dark. some things save their best for the hours nobody applauds.', 'nocturne', 88, '0:39'],
  ['answeringmachineghost', 'tape 2', 'the answering machine tape still has 1997 on it. press play and the kitchen fills with people who are elsewhere now.', 'lost', 93, '0:55'],
  ['intheglovebox', 'inventory', 'glovebox: napkins, a dead flashlight, a map of a state we never went to. a museum of intentions.', 'drift', 69, '0:24'],
  ['hoodiebythelake', 'left there', 'left my hoodie at the lake on purpose. somebody cold will find it. that\'s the whole plan. that\'s the whole prayer.', 'bloom', 87, '0:36'],
  ['streetsweeperthursday', '5am', 'the street sweeper comes thursday before dawn, brushes the whole block clean for people who will never know. me neither, mostly. but thursday knows.', 'nocturne', 78, '0:41'],
  ['untitledfeeling', 'unfiled', 'there\'s a feeling between nostalgia and hunger that has no name. it lives in lit windows seen from trains.', 'drift', 90, '0:32'],
  ['basementtapehiss', 'side b', 'found the band\'s old practice tape. mostly hiss. underneath the hiss: four kids who thought they had forever. tape kept both.', 'lost', 89, '0:50'],
  ['drivethruintercom', 'order up', 'the drive-thru voice asked "anything else?" and i almost said "yeah, the years back." got the fries instead.', 'static', 75, '0:30'],
  ['atduskexactly', 'every day', 'there\'s a minute at dusk when the streetlights and the sky are the same brightness. nobody claps. i clap, internally.', 'bloom', 82, '0:33'],
  ['nooneclaimed', 'lost and found', 'the lost and found box at the rec center has a single red mitten from before i worked here. somewhere: a cold left hand. holding on.', 'lost', 84, '0:38'],
]

export const GHOST_ARCHIVE: GhostSignal[] = ROWS.map(([handle, timeAgo, content, mood, resonance, duration], index) => ({
  id: `ghost-${index + 1}`,
  handle,
  timeAgo,
  content,
  mood,
  resonance,
  anonymous: index % 3 === 0,
  duration,
  waveformSeed: 113 + index * 7,
}))
