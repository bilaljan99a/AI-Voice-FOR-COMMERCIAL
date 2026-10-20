import { AdTemplate, Language, VoiceName, SpeechStyle } from '../types';

export const PAKISTANI_AD_TEMPLATES: AdTemplate[] = [
  // --- DUAL-SPEAKER COMMERCIAL DIALOGUES (MALE + FEMALE) ---
  {
    id: 'chai-dialogue-fmcg',
    title: '☕ Shaahi Chai (Shohar & Biwi Commercial Dialogue)',
    category: 'Tea & FMCG Dialogue',
    brandType: 'Male + Female Dialogue',
    isDialogue: true,
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Hamza_Pak_Male,
    suggestedFemaleVoice: VoiceName.Maryam_Pak_Female,
    suggestedStyle: SpeechStyle.Pakistani_Chai_Warm,
    suggestedSpeed: 1.0,
    script: `Male: Arey suno! Subah ki dhoop nikal aayi hai, per garam chai kahan hai?
Female: Ye lijiye janaab! Aapke liye banai hai taaza Shaahi Danedar Chai.
Male: Wah bhai wah! Pehli hi chuski mein apnepan ka wo pyara ehsaas!
Female: Shaahi Chai... Kyun ke har ghoont mein bachta hai apnapan!`
  },
  {
    id: 'dhamaka-sale-dialogue',
    title: '💥 Bari Eid Bumper Sale (Shopping Friends Dialogue)',
    category: 'Retail Sale Dialogue',
    brandType: 'Male + Female Promo',
    isDialogue: true,
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Hamza_Pak_Male,
    suggestedFemaleVoice: VoiceName.Ayesha_Pak_Female,
    suggestedStyle: SpeechStyle.Pakistani_Dhamaka,
    suggestedSpeed: 1.08,
    script: `Male: Suno Ayesha! Is Bari Eid par Mega Mart par pure 50% discount ka sab se bara dhamaka shuru ho gaya hai!
Female: Sach mein Hamza? Pure pachas feesad? Phir to humein abhi chalna chahiye shopping ke liye!
Male: Bilkul! Designer kapray, joote aur electronics... sab kuch aik hi chat ke neechay.
Female: To der kis baat ki! Aaj hi tashreef laayein aur bachat ka faida uthayein!`
  },
  {
    id: 'food-delivery-dialogue',
    title: '🍕 Food Delivery App (Late Night Bhook Dialogue)',
    category: 'Quick Commerce Dialogue',
    brandType: 'Male + Female Youth',
    isDialogue: true,
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Bilal_Pak_Male,
    suggestedFemaleVoice: VoiceName.Zara_Pak_Female,
    suggestedStyle: SpeechStyle.Pakistani_Food_Delivery,
    suggestedSpeed: 1.12,
    script: `Female: Raat ke 12 baj gaye hain aur mujhe sakht bhook lagi hai!
Male: Pareshan kyun hoti ho? Foodiez App kholiye aur garma garam biryani order kijiye!
Female: Wah! Kitni der mein pohnchay gi?
Male: Sirf 20 minute mein, aur code lagane par flat 40% discount!`
  },
  {
    id: 'real-estate-dialogue',
    title: '🏙️ Margalla Luxury Enclave (Couple Housing Discussion)',
    category: 'Real Estate Dialogue',
    brandType: 'Male + Female Prestige',
    isDialogue: true,
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Tariq_Pak_Male,
    suggestedFemaleVoice: VoiceName.Sana_Pak_Female,
    suggestedStyle: SpeechStyle.Pakistani_RealEstate,
    suggestedSpeed: 0.96,
    script: `Male: Margalla Hills ke daman mein aik pur-asaish aur pur-sukoon ghar... Yehi to tha hamara khwab.
Female: Aur ab Gulberg Royal Enclave mein ye khwab haqeeqat ban raha hai!
Male: Jadeed tareen suhooliyat, round the clock security aur aala miyaar-e-zindagi.
Female: Booking shuru ho chuki hai, mehdood plots dastyab!`
  },

  // --- SINGLE-SPEAKER COMMERCIAL PROMOS ---
  {
    id: 'dhamaka-sale-eid',
    title: 'Bari Eid Bumper Sale (Single Male Promo)',
    category: 'Retail & Superstore',
    brandType: 'Dhamaka Offer',
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Hamza_Pak_Male,
    suggestedStyle: SpeechStyle.Pakistani_Dhamaka,
    suggestedSpeed: 1.1,
    script: 'Khushkhabri! Khushkhabri! Is Bari Eid par laya hai Mega Mart sab se bara Dhamaka Offer! Har cheez par pure pachas feesad tak ki bachat. Kapray, joote, bartan aur electronics... sab kuch aik hi chat ke neechay! Offer mehdood muddat ke liye hai, aaj hi tashreef laayein aur bachat ka faida uthayein!'
  },
  {
    id: 'chai-fmcg-urdu',
    title: 'Shaahi Chai (Ghar Ka Apnapan Urdu)',
    category: 'Tea & FMCG',
    brandType: 'Emotional Brand',
    language: Language.Urdu,
    suggestedVoice: VoiceName.Maryam_Pak_Female,
    suggestedStyle: SpeechStyle.Pakistani_Chai_Warm,
    suggestedSpeed: 0.95,
    script: 'صبح کی پہلی کرن، اور گرم چائے کی دھیمی خوشبو۔۔۔ اپنے پیاروں کے ساتھ گزارا ہر لمحہ خاص بناتی ہے۔ شاہی دانے دار چائے، جو لائے دلوں میں اپنائیت اور چہرے پر مسکراہٹ۔ کیونکہ ہر گھونٹ میں بستا ہے اپناپن۔'
  },
  {
    id: 'beauty-lawn-fashion',
    title: 'Noor-e-Kashmir Festive Lawn (Beauty)',
    category: 'Fashion & Cosmetics',
    brandType: 'Glamour & Nazakat',
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Ayesha_Pak_Female,
    suggestedStyle: SpeechStyle.Pakistani_Lawn_Beauty,
    suggestedSpeed: 0.95,
    script: 'Khubsurati jo dilon ko moh le... Dilkash rang, bareek kadhaai, aur pure chiffon duppatta. Noor Fashion ki nai Festive Lawn Collection ab dastyab hai tamam leading stores aur online. Sajaiye apna har pal, ba-waqar andaaz mein.'
  },
  {
    id: 'ramadan-kareem-blessing',
    title: 'Ramadan Mubarak Special Greetings',
    category: 'Festive & CSR',
    brandType: 'Spiritual / Soft',
    language: Language.Urdu,
    suggestedVoice: VoiceName.Farhan_Pak_Male,
    suggestedStyle: SpeechStyle.Pakistani_Ramadan_Eid,
    suggestedSpeed: 0.9,
    script: 'ماہِ رمضان کی پرنور ساعتیں اور رحمتوں کا نزول۔ اس مبارک مہینے میں آئیں ضرورت مندوں کا سہارا بنیں اور خوشیاں بانٹیں۔ ہم سب کی طرف سے آپ کو اور آپ کی فیملی کو دل کی گہرائیوں سے رمضان مبارک۔'
  }
];
