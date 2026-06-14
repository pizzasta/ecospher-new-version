// NOTE: these rules are mirrored server-side in
// supabase/migrations/202606110010_server_guardian.sql (moderate_signal_text)
// — change both together. The trigger is the enforcement; this is the UX.

export type SignalSafetyFlag = 'harassment' | 'threats' | 'explicit_personal_information' | 'spam' | 'unsafe_content' | 'child_safety' | 'sexual_content'

export type SignalModerationResult = {
  status: 'passed' | 'flagged'
  flags: SignalSafetyFlag[]
  warning: string | null
}

export function moderatePublicSignalText(text: string): SignalModerationResult {
  const normalizedText = text.toLowerCase()
  const flags = new Set<SignalSafetyFlag>()

  if (/\b(kill|hurt|attack|stab|shoot|bomb|threat)\b/.test(normalizedText)) {
    flags.add('threats')
  }

  if (/\b(hate you|idiot|stupid|worthless|trash|loser)\b/.test(normalizedText)) {
    flags.add('harassment')
  }

  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) || /\b[\w.-]+@[\w.-]+\.\w{2,}\b/.test(text) || /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/i.test(text)) {
    flags.add('explicit_personal_information')
  }

  if (/(https?:\/\/|www\.|free money|promo code|buy now|subscribe now)/i.test(text)) {
    flags.add('spam')
  }

  if (/\b(self harm|suicide|overdose|exploit|blackmail)\b/.test(normalizedText)) {
    flags.add('unsafe_content')
  }

  // explicit sexual content + solicitation. deliberately narrow: bare
  // expletives ("fuck this day") are late-night vocabulary, not sexual
  // content — only unambiguous terms and solicitations flag.
  if (
    /\b(nudes?|sexting|sext\b|horny|dick pic|nude (pic|pics|photo|photos)|naked (pic|pics|photo|photos))\b/.test(normalizedText) ||
    /\b(blow ?job|hand ?job|jerk(ing)? off|cum(ming)?\b|tits|pussy|cock\b)/.test(normalizedText) ||
    /\b(send (me )?something (sexy|hot)|wanna sext|fuck (me|you tonight)|netflix and chill\?)/.test(normalizedText) ||
    /\b(onlyfans|check (out )?my of\b)/.test(normalizedText)
  ) {
    flags.add('sexual_content')
  }

  // predator-pattern screen: age solicitation, off-platform contact pulls,
  // photo requests, meet-up pressure, minor self-identification
  if (
    /\b(how old are you|what('| i)?s your age|\basl\b|are you a (girl|boy))\b/.test(normalizedText) ||
    /\b(add me on|dm me|message me on|find me on)\b.*\b(snap|snapchat|kik|insta|instagram|whatsapp|telegram|discord)\b/.test(normalizedText) ||
    /\b(snap|snapchat|kik|whatsapp|telegram)\b.*\b(me|you)\b/.test(normalizedText) ||
    /\b(send|show) (me )?(a |your )?(pic|pics|picture|photo|photos|selfie)/.test(normalizedText) ||
    /\b(meet (up|me)|where do you live|what school)\b/.test(normalizedText) ||
    /\b(i('| a)?m|im) (1[0-7]|a minor)\b/.test(normalizedText)
  ) {
    flags.add('child_safety')
  }

  const nextFlags = Array.from(flags)

  return {
    status: nextFlags.length > 0 ? 'flagged' : 'passed',
    flags: nextFlags,
    warning: getPublicSignalSafetyWarning(nextFlags),
  }
}

export function getPublicSignalSafetyWarning(flags: SignalSafetyFlag[]) {
  if (flags.length === 0) {
    return null
  }

  if (flags.includes('sexual_content')) {
    return "This isn't that kind of frequency. Sexual content stays off the public band."
  }

  if (flags.includes('child_safety')) {
    return 'This stays private. Ecosphere has no private contact, no photos, and no place for finding people — by design.'
  }

  if (flags.includes('explicit_personal_information')) {
    return 'This sounds like it may contain personal information, so it stayed private. Edit the text before publishing publicly.'
  }

  if (flags.includes('threats') || flags.includes('harassment')) {
    return 'This signal may sound unsafe toward someone, so it stayed private. Soften the text before publishing publicly.'
  }

  if (flags.includes('spam')) {
    return 'This signal looks promotional, so it stayed private. Edit the text before publishing publicly.'
  }

  return 'This signal needs a quieter edit before it can drift publicly.'
}
