import { AdTemplate, Language, VoiceName, SpeechStyle } from '../types';

export const PAKISTANI_AD_TEMPLATES: AdTemplate[] = [
  {
    id: 'dhamaka-sale-eid',
    title: 'Bari Eid Bumper Sale (Dhamaka Promo)',
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
    title: 'Shaahi Chai (Ghar Ka Apnapan)',
    category: 'Tea & FMCG',
    brandType: 'Emotional Brand',
    language: Language.Urdu,
    suggestedVoice: VoiceName.Maryam_Pak_Female,
    suggestedStyle: SpeechStyle.Pakistani_Chai_Warm,
    suggestedSpeed: 0.95,
    script: 'صبح کی پہلی کرن، اور گرم چائے کی دھیمی خوشبو۔۔۔ اپنے پیاروں کے ساتھ گزارا ہر لمحہ خاص بناتی ہے۔ شاہی دانے دار چائے، جو لائے دلوں میں اپنائیت اور چہرے پر مسکراہٹ۔ کیونکہ ہر گھونٹ میں بستا ہے اپناپن۔'
  },
  {
    id: 'real-estate-housing',
    title: 'Islamabad Luxury Enclave (Mega Housing)',
    category: 'Real Estate & Property',
    brandType: 'Luxury Baritone',
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Tariq_Pak_Male,
    suggestedStyle: SpeechStyle.Pakistani_RealEstate,
    suggestedSpeed: 0.9,
    script: 'Islamabad ki purfiza wadiyon mein, Margalla Hills ke daman mein... Aik shandaar aur pur-asaish rehayesh ka khwab. Gulberg Royal Enclave! Jahan jadeed tareen suhooliyat, round the clock security aur pur-sukoon mahol mil kar banatay hain aapka mustaqbil. Booking shuru ho chuki hai, mehdood plots dastyab!'
  },
  {
    id: 'beauty-lawn-fashion',
    title: 'Noor-e-Kashmir Festive Lawn',
    category: 'Fashion & Cosmetics',
    brandType: 'Glamour & Nazakat',
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Ayesha_Pak_Female,
    suggestedStyle: SpeechStyle.Pakistani_Lawn_Beauty,
    suggestedSpeed: 0.95,
    script: 'Khubsurati jo dilon ko moh le... Dilkash rang, bareek kadhaai, aur pure chiffon duppatta. Noor Fashion ki nai Festive Lawn Collection ab dastyab hai tamam leading stores aur online. Sajaiye apna har pal, ba-waqar andaaz mein.'
  },
  {
    id: 'food-delivery-app',
    title: 'Foodiez App (20-Minute Delivery)',
    category: 'Quick Commerce & Food',
    brandType: 'Youth & Fast-Paced',
    language: Language.RomanUrdu,
    suggestedVoice: VoiceName.Bilal_Pak_Male,
    suggestedStyle: SpeechStyle.Pakistani_Food_Delivery,
    suggestedSpeed: 1.15,
    script: 'Bhook lagi hai? Garma garam biryani, cheesy burger ya meethay gulab jamun? Ab intizar kaisa! Foodiez App kholiye, apna pasandeeda khana select karein aur paayein 20 minute mein seedha aapki chokhat par. Pehle order par Flat 40% discount ke liye code use karein EATNOW!'
  },
  {
    id: 'bilingual-fintech-bank',
    title: 'PaisaPay Mobile Wallet (Smart Banking)',
    category: 'Fintech & Telecom',
    brandType: 'Bilingual Tech',
    language: Language.English,
    suggestedVoice: VoiceName.Zayd_Pak_Male,
    suggestedStyle: SpeechStyle.Pakistani_Bilingual_Tech,
    suggestedSpeed: 1.0,
    script: 'Say goodbye to long bank lines. PaisaPay ke sath money transfer karein kisi bhi bank account mein instantly, with zero hidden charges. Pay utility bills, buy mobile load and shop online effortlessly. PaisaPay - Aapka digital batwa!'
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
  },
  {
    id: 'hindi-commercial-sale',
    title: 'Maha Bachat Festival (Hindi Commercial)',
    category: 'Retail & E-Commerce',
    brandType: 'High-Impact Sale',
    language: Language.Hindi,
    suggestedVoice: VoiceName.Faizan_Pak_Male,
    suggestedStyle: SpeechStyle.Pakistani_Dhamaka,
    suggestedSpeed: 1.1,
    script: 'साल का सबसे बड़ा डिस्काउंट धमाका शुरू हो चुका है! स्मार्टफोन्स, इलेक्ट्रॉनिक्स और होम अप्लायंसेज पर पाएं सीधे 60% तक की भारी छूट। सीमित समय का ऑफर, आज ही शॉपिंग करें और अपनी बचत को डबल करें!'
  }
];
