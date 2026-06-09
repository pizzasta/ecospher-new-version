export type SignalSafetyFlag = 'harassment' | 'threats' | 'explicit_personal_information' | 'spam' | 'unsafe_content'

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
