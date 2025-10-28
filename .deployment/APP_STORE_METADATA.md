# App Store Metadata Requirements

This document outlines the metadata requirements for submitting VerseMate Mobile to the App Store (iOS) and Google Play Store (Android).

## iOS App Store Connect Requirements

### Required Information

#### App Information
- **App Name**: VerseMate (already configured)
- **Bundle ID**: org.versemate.mobile (already configured)
- **SKU**: versemate-mobile-ios (already configured)
- **Primary Language**: English (US)

#### Version Information
- **Version Number**: Must match app.json version (currently 0.1.0)
- **Build Number**: Auto-incremented by EAS Build
- **Copyright**: Year and company name (e.g., "2025 VerseMate")

#### Category
- **Primary Category**: Reference (or Education, depending on app focus)
- **Secondary Category**: Education (optional)

#### Age Rating
Complete the age rating questionnaire in App Store Connect:
- Violence: None
- Medical/Treatment Info: None
- Profanity or Crude Humor: None
- Sexual Content or Nudity: None
- Cartoon or Fantasy Violence: None
- Realistic Violence: None
- Prolonged Graphic or Sadistic Violence: None
- Sexual Content or Nudity: None
- Alcohol, Tobacco, or Drug Use: None
- Gambling: None
- Horror/Fear Themes: None
- Mature/Suggestive Themes: None
- Uncontrolled Game Content: None
- Gambling Contests: None

Expected Rating: 4+ (no objectionable content)

### App Store Listing

#### App Name
- **Length**: Maximum 30 characters
- **Recommendation**: "VerseMate" (9 characters)

#### Subtitle (Optional)
- **Length**: Maximum 30 characters
- **Purpose**: Brief description shown under app name
- **Recommendation**: "Bible Reading & Study" or "AI-Powered Bible Study"

#### Promotional Text (Optional)
- **Length**: Maximum 170 characters
- **Purpose**: Can be updated without app review
- **Use Case**: Announce new features, events, or promotions

#### Description
- **Length**: Maximum 4000 characters
- **Purpose**: Main app description shown on App Store
- **Requirements**:
  - Clearly explain what the app does
  - Highlight key features
  - Include any special requirements or subscriptions
  - Avoid marketing speak and focus on functionality
  - No contact information or URLs (except privacy policy in designated field)

**Description Template:**
```
VerseMate is your companion for reading and studying the Bible with AI-powered explanations and insights.

KEY FEATURES:
• Read the complete Bible with a clean, distraction-free interface
• Navigate by book, chapter, and verse with intuitive page-based swiping
• Get AI-powered explanations and insights for any passage
• Dark mode support for comfortable reading at any time
• Deep linking to specific Bible passages
• Offline reading capability

BIBLE VERSIONS:
• King James Version (KJV) and other popular translations
• Easy switching between versions

AI-POWERED INSIGHTS:
• Ask questions about any verse or passage
• Get contextual explanations and historical background
• Explore theological concepts and connections
• Personalized learning experience

READING EXPERIENCE:
• Beautiful typography optimized for extended reading
• Page-based navigation with smooth swipe gestures
• Bookmark and highlight your favorite passages
• Share verses with friends and family

VerseMate makes Bible study accessible, engaging, and enriching for everyone from beginners to seasoned scholars.
```

#### Keywords
- **Length**: Maximum 100 characters (comma-separated)
- **Purpose**: Help users find your app in App Store search
- **Best Practices**:
  - Use specific, relevant terms
  - Avoid app name (already indexed)
  - Don't repeat keywords
  - Use singular forms (App Store handles pluralization)
  - Consider misspellings if common

**Keyword Suggestions:**
```
bible,scripture,verse,study,christian,faith,religion,devotional,spiritual,gospel,testament,prayer,church,theology,holy book
```

#### Support URL
- **Required**: Yes
- **Purpose**: Link for user support
- **Format**: Must be a valid URL
- **Recommendation**: Create a support page on versemate.org (e.g., https://versemate.org/support)

#### Marketing URL (Optional)
- **Purpose**: Link to app marketing page
- **Recommendation**: https://versemate.org or https://app.versemate.org

#### Privacy Policy URL
- **Required**: Yes for apps on App Store
- **Purpose**: Link to privacy policy
- **Requirements**:
  - Must be accessible without authentication
  - Must clearly explain data collection and usage
  - Required even if app collects no data
- **Recommendation**: Create privacy policy at https://versemate.org/privacy

### Screenshots

#### Required Sizes (iOS 16+)

**iPhone 6.7" Display** (Required - iPhone 14 Pro Max, 15 Pro Max)
- Size: 1290 x 2796 pixels
- Minimum: 1 screenshot, Maximum: 10 screenshots
- Format: PNG or JPG (no transparency)

**iPhone 6.5" Display** (Optional - iPhone 11 Pro Max, XS Max)
- Size: 1242 x 2688 pixels
- Note: Can substitute 6.7" screenshots

**iPhone 5.5" Display** (Optional - iPhone 8 Plus)
- Size: 1242 x 2208 pixels

**iPad Pro (6th Gen) 12.9" Display** (Required if iPad supported)
- Size: 2048 x 2732 pixels
- Minimum: 1 screenshot, Maximum: 10 screenshots

**iPad Pro (2nd Gen) 12.9" Display** (Optional)
- Size: 2048 x 2732 pixels

#### Screenshot Guidelines
- Show actual app functionality
- No device frames required (App Store adds them)
- Use high-quality images
- Show key features in first 1-3 screenshots
- Consider adding text overlays to explain features
- Maintain consistent design language
- Show both light and dark modes if applicable
- Include diverse content examples

#### Recommended Screenshot Sequence
1. Main Bible reading interface
2. AI explanation feature in action
3. Navigation/browsing features
4. Search or verse lookup
5. Settings or customization options

### App Preview Video (Optional)

**Specifications:**
- Length: 15-30 seconds recommended (max 30 seconds for app store)
- Resolution: Matches screenshot resolutions
- Format: M4V, MP4, or MOV
- Codec: H.264 or HEVC
- Aspect Ratio: 16:9 for landscape, device aspect ratio for portrait

**Content Guidelines:**
- Show actual app footage only (no live action)
- Focus on core functionality
- Keep it concise and engaging
- Can have audio narration or music
- Must comply with App Store Review Guidelines

### Review Information

#### Review Notes
- Provide test account credentials if app requires authentication
- Explain any non-obvious features
- Provide context for special permissions
- Note any regional restrictions

#### Contact Information
- **First Name**: [Your first name]
- **Last Name**: [Your last name]
- **Phone Number**: [Valid phone number with country code]
- **Email**: [Contact email for app review team]

### Export Compliance

For apps distributed outside the US, you must answer export compliance questions:

**Does your app use encryption?**
- If app uses HTTPS only (standard): Select "No" or "Uses standard encryption"
- If app implements custom encryption: May require Export Compliance documentation

For VerseMate (uses standard HTTPS):
- Answer: "No" (already configured in app.json with `ITSAppUsesNonExemptEncryption: false`)

### Content Rights

**Do you have the rights to use all content in your app?**
- Answer: "Yes"
- Ensure you have rights to:
  - Bible text (most versions are public domain, some require license)
  - All images and icons
  - Any third-party libraries or SDKs
  - AI service API usage

---

## Android Google Play Console Requirements

### Store Listing

#### App Details
- **App Name**: VerseMate
- **Short Description**: Maximum 80 characters
  - Example: "Bible reading with AI-powered explanations and verse-by-verse insights"
- **Full Description**: Maximum 4000 characters (can reuse iOS description with minor adjustments)

#### Graphics

**App Icon**
- Size: 512 x 512 pixels
- Format: 32-bit PNG with alpha
- File size: Maximum 1 MB
- Note: Must match icon in APK/AAB

**Feature Graphic** (Required)
- Size: 1024 x 500 pixels
- Format: PNG or JPG (no transparency)
- Purpose: Shown in featured sections

**Phone Screenshots** (Required)
- Minimum: 2 screenshots
- Maximum: 8 screenshots
- Size: Minimum 320px on short side, maximum 3840px on long side
- Recommended: 1080 x 1920 pixels (portrait) or 1920 x 1080 pixels (landscape)
- Format: PNG or JPG (no transparency)

**7-inch Tablet Screenshots** (Optional)
- Size: Minimum 320px, maximum 3840px
- Recommended: 1200 x 1920 pixels

**10-inch Tablet Screenshots** (Optional)
- Size: Minimum 1080px, maximum 7680px
- Recommended: 1800 x 2560 pixels

**Promo Video** (Optional)
- Format: YouTube URL
- Purpose: Shows in store listing

#### Categorization

**Application Type**
- Applications (not Games)

**Category**
- Primary: Books & Reference
- Alternative: Education

**Tags** (Optional)
- Add relevant tags for discoverability
- Examples: bible, scripture, study, christian, religion

**Content Rating**
Complete the content rating questionnaire:
- Violence: None
- Sexual Content: None
- Language: None
- Controlled Substances: None
- Gambling: None
- User Interaction: No (unless app has social features)
- User-Generated Content: No (unless app allows user content)
- Shares Location: No (unless app uses location)

Expected Rating: Everyone (all ages)

#### Contact Details
- **Email**: Public email for user inquiries
- **Phone**: Optional
- **Website**: https://versemate.org

#### Privacy Policy
- **URL**: Required (same as iOS)
- **Example**: https://versemate.org/privacy

### Store Presence

#### Countries/Regions
- Select countries where app will be available
- Recommendation: Start with primary markets, expand later
- Can be changed after launch

#### Pricing & Distribution
- **Free or Paid**: Free (with optional in-app purchases if applicable)
- **Contains Ads**: No (unless app has ads)
- **In-app Purchases**: Declare if app has any
- **Content Rating**: Based on questionnaire
- **Target Audience**: All ages or specific age ranges

### App Content

#### Privacy Policy
- Required for all apps
- Must be accessible URL

#### App Access
- Is your app restricted to specific users?
  - Usually: No (public app)
  - If yes: Provide test account

#### Ads
- Does your app contain ads?
  - VerseMate: No (unless you add ads)

#### Content Rating
Complete IARC questionnaire (similar to iOS age rating)

#### Target Audience & Content
- **Target Age Groups**: All ages
- **Appeal to Children**: If yes, must comply with COPPA/GDPR-K

### Data Safety Section (Required)

Starting 2022, Google requires data safety declaration:

#### Data Collection
Declare what data your app collects:
- **Personal Info**: Name, email (if user accounts exist)
- **Financial Info**: Payment info (if in-app purchases)
- **Location**: Approximate/Precise (if app uses location)
- **App Activity**: App interactions, crash logs
- **Device or Other IDs**: Device IDs

#### Data Usage
For each data type collected:
- Why it's collected (functionality, analytics, etc.)
- Whether it's shared with third parties
- Security practices (encryption in transit, user can request deletion, etc.)

#### Example for VerseMate:
```
Collected Data:
- App interactions and crash logs (for analytics and debugging)
- [Other data based on your actual app functionality]

Not Collected:
- Name, email, or personal identifiers (unless app has accounts)
- Location
- Financial information
- Photos, videos, or audio files

Security Practices:
- Data encrypted in transit
- User can request data deletion
- Data not shared with third parties (or specify if using analytics services)
```

---

## Checklist: Ready for Submission

### iOS App Store Connect
- [ ] App registered in App Store Connect
- [ ] App name, bundle ID, SKU configured
- [ ] Privacy policy URL created and accessible
- [ ] Support URL created and accessible
- [ ] App description written (max 4000 characters)
- [ ] Keywords selected (max 100 characters)
- [ ] iPhone 6.7" screenshots created (minimum 1)
- [ ] iPad screenshots created (if supporting iPad)
- [ ] App icon verified (1024x1024 in App Store Connect)
- [ ] Age rating questionnaire completed
- [ ] Export compliance declared
- [ ] Review contact information provided
- [ ] Promotional text written (optional)
- [ ] Marketing URL added (optional)
- [ ] App preview video created (optional)

### Android Google Play Console
- [ ] App created in Google Play Console
- [ ] App name and package configured
- [ ] Short description written (max 80 characters)
- [ ] Full description written (max 4000 characters)
- [ ] Feature graphic created (1024 x 500)
- [ ] Phone screenshots created (minimum 2)
- [ ] App icon verified (512 x 512)
- [ ] Category selected
- [ ] Content rating questionnaire completed
- [ ] Privacy policy URL added
- [ ] Contact email provided
- [ ] Data safety section completed
- [ ] Countries/regions selected
- [ ] Pricing set (free or paid)
- [ ] Tablet screenshots created (optional)
- [ ] Promo video URL added (optional)

---

## App Store Review Guidelines Considerations

### iOS App Store Review Guidelines

**Key Points to Ensure Compliance:**

1. **Accurate Metadata**
   - App name, description, and screenshots must accurately represent app functionality
   - No misleading claims or fake reviews

2. **Content Policy**
   - Religious content is allowed
   - Must not be defamatory or mean-spirited toward any group
   - Must respect intellectual property (Bible versions, etc.)

3. **AI-Generated Content**
   - Must clearly indicate AI-generated explanations
   - Must have human review/moderation if content is user-facing
   - Must comply with content safety guidelines

4. **Data Collection**
   - If collecting user data, must have privacy policy
   - Must explain data usage clearly
   - Must request appropriate permissions

5. **Third-Party Services**
   - If using AI APIs (OpenAI, etc.), ensure compliance with their terms
   - Must handle API failures gracefully

6. **Business Model**
   - If free, must not have hidden costs
   - In-app purchases must be clear and fair
   - Subscriptions must follow Apple's guidelines

**Common Rejection Reasons to Avoid:**
- Crashes or bugs (test thoroughly!)
- Broken links (privacy policy, support URL)
- Misleading metadata
- Missing age rating
- Incomplete app functionality
- Poor user experience

### Google Play Developer Policies

**Key Points:**

1. **Content Policy**
   - Religious content allowed
   - Must be respectful and non-hateful
   - No dangerous or derogatory content

2. **User Data**
   - Must have privacy policy
   - Data safety section must be accurate
   - Must handle permissions properly

3. **AI Content**
   - Disclose AI-generated content
   - Ensure content is appropriate
   - Must not generate harmful content

4. **Monetization**
   - Clear disclosure of costs
   - Proper implementation of in-app billing

5. **Device Compatibility**
   - Must work on supported devices
   - No excessive battery drain
   - Reasonable storage requirements

**Common Rejection Reasons:**
- Crashes or ANR (Application Not Responding)
- Privacy policy issues
- Inappropriate content
- Misleading store listing
- Broken core functionality

---

## Next Steps After Metadata Completion

1. **Prepare Assets**
   - Design screenshots for all required sizes
   - Create feature graphic (Android)
   - Prepare app preview video (optional)

2. **Create Support Pages**
   - Privacy policy page
   - Support/help page
   - Marketing page (optional)

3. **Complete Store Listings**
   - Fill in all metadata in App Store Connect
   - Fill in all metadata in Google Play Console
   - Upload all graphics and screenshots

4. **Submit for Review**
   - See PRODUCTION_SUBMISSION.md for submission workflow
   - Plan for 1-3 day review process (iOS)
   - Plan for few hours to few days review (Android)

5. **Monitor Review Status**
   - Check daily for feedback
   - Respond quickly to review team questions
   - Be prepared for potential rejection and resubmission

---

## Resources

### iOS
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [App Preview Specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications)

### Android
- [Google Play Developer Policy](https://play.google.com/about/developer-content-policy/)
- [Launch Checklist](https://developer.android.com/distribute/best-practices/launch/launch-checklist)
- [Store Listing Specifications](https://support.google.com/googleplay/android-developer/answer/9866151)

### Design Tools
- [Figma](https://figma.com) - For designing screenshots and graphics
- [Canva](https://canva.com) - Quick graphic creation
- [Screenshot Designer](https://www.applaunchpad.com/) - App screenshot templates
