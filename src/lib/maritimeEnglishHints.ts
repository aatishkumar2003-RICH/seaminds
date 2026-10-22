// Native-language hints: understand the situation in your language, answer in English.
import { VI_HINTS } from "@/lib/maritimeEnglish";

export type HintLang = "en" | "vi" | "id" | "hi";
export const HINT_LANGS: { code: HintLang; flag: string; label: string; answerInEnglish: string }[] = [
  { code: "en", flag: "🇬🇧", label: "English", answerInEnglish: "Speak clearly using standard IMO SMCP." },
  { code: "vi", flag: "🇻🇳", label: "Tiếng Việt", answerInEnglish: "Trả lời bằng tiếng Anh." },
  { code: "id", flag: "🇮🇩", label: "Bahasa Indonesia", answerInEnglish: "Jawab dalam bahasa Inggris." },
  { code: "hi", flag: "🇮🇳", label: "हिन्दी", answerInEnglish: "उत्तर अंग्रेज़ी में दें।" },
];

const EN: Record<string, string> = {
  "vhf-tss": "VTS gives an instruction. Start with the station names, say \"Read back\", repeat the anchorage and the lane exactly, end with \"Over\".",
  "vhf-crossing": "Crossing situation. Name the other vessel, say you received the advice, state you keep course and speed, end with \"Over\".",
  "vhf-pilot": "Pilot boarding. Read back the time, the side (port/starboard) and the ladder height. Echo every number.",
  "eng-handover": "Watch handover. Report main engine, generator on load, bilge level and alarms in short clear sentences.",
  "eng-alarm": "Alarm report to the bridge. Use \"Information\": name the alarm, then say what you are doing (reduce load, check pump).",
  "eng-bunker": "Bunkering. Say \"Read back\", repeat the rate with its unit (cubic metres per hour), then confirm.",
  "safe-fire": "Fire report. Start with \"Warning\", give the exact location, then crew mustering and fire team status.",
  "safe-mob": "Man overboard. Shout it first, then the side of the ship, then that the lifebuoy is thrown.",
  "safe-mayday": "Distress message. Read back vessel name, position, problem and persons on board. Acknowledge the Mayday.",
  "psc-ows": "PSC question on the oily water separator. Explain the 15 ppm alarm test and the Oil Record Book entry.",
  "psc-enclosed": "Enclosed space entry. Explain permit, ventilation, gas/oxygen test and the standby person, in order.",
  "psc-drill": "Abandon ship drill. Say your muster station and your exact duty there.",
  "rat-helm": "Helm order. Repeat the officer's order word for word (direction, degrees, course), then report when steady.",
  "rat-lookout": "Lookout report. Object type, bearing (port/starboard bow) and distance.",
  "rat-mooring": "Forward station report. Number of head lines and springs made fast, and tug made fast.",
  "rat-gangway": "Gangway watch. Ask for ID, log the visitor and call the duty officer.",
  "eng-sounding": "Morning soundings. Tank name, number, side and volume or percentage.",
  "vhf-anchor": "Anchored report. Name the anchorage and the shackles in the water.",
};

const VI_EXTRA: Record<string, string> = {
  "rat-helm": "Lệnh lái. Nhắc lại chính xác lệnh của sĩ quan (hướng bánh lái, số độ, hướng đi) rồi báo khi tàu đã ổn định.",
  "rat-lookout": "Báo cáo cảnh giới: loại mục tiêu, phương vị (mạn trái/phải, bao nhiêu quarter) và khoảng cách.",
  "rat-mooring": "Báo cáo trạm mũi: số dây mũi, dây chéo đã buộc chắc, tàu lai đã buộc dây.",
  "rat-gangway": "Trực cầu thang: yêu cầu giấy tờ tùy thân, ghi sổ khách và gọi sĩ quan trực ca.",
  "eng-sounding": "Báo cáo đo két buổi sáng: tên két, số két, mạn, khối lượng hoặc phần trăm.",
  "vhf-anchor": "Báo cáo đã thả neo: khu neo nào, bao nhiêu đường lỉn (shackle) dưới nước.",
};

const ID: Record<string, string> = {
  "vhf-tss": "VTS memerintahkan kapal menuju area labuh jangkar dan menjauhi alur pelayaran tertentu. Ulangi (read back) perintah dengan tepat, akhiri dengan \"Over\".",
  "vhf-crossing": "Situasi bersilangan. Akui pesan kapal lain dan nyatakan Anda akan mempertahankan haluan dan kecepatan.",
  "vhf-pilot": "Pandu akan naik. Ulangi waktu, sisi kapal (kiri/kanan) dan tinggi tangga pandu.",
  "eng-handover": "Serah terima jaga kamar mesin. Laporkan kondisi mesin induk, generator/purifier, tekanan dan alarm.",
  "eng-alarm": "Alarm suhu tinggi air pendingin. Laporkan ke anjungan: apa masalahnya dan tindakan Anda (kurangi beban, periksa pompa).",
  "eng-bunker": "Konfirmasi laju pemompaan bunker dari tongkang. Ulangi angka dan satuannya (meter kubik per jam).",
  "safe-fire": "Kebakaran di kamar mesin. Laporkan lokasi api, awak berkumpul dan tim pemadam siap. Gunakan kata \"Warning\".",
  "safe-mob": "Orang jatuh ke laut. Laporkan sisi kapal dan bahwa pelampung sudah dilempar.",
  "safe-mayday": "Sinyal darurat Mayday. Ulangi nama kapal, posisi, kondisi dan jumlah orang di atas kapal.",
  "psc-ows": "Inspektur PSC bertanya tentang alarm 15 ppm pada separator air berminyak (OWS). Jelaskan pengujian dan pencatatan di Oil Record Book.",
  "psc-enclosed": "Jelaskan prosedur masuk ruang tertutup: izin kerja, ventilasi, uji gas/oksigen, petugas siaga.",
  "psc-drill": "Jelaskan tugas Anda saat latihan meninggalkan kapal: stasiun berkumpul dan pekerjaan Anda.",
  "rat-helm": "Perintah kemudi. Ulangi perintah perwira dengan tepat (arah, derajat, haluan), lalu lapor saat kapal sudah steady.",
  "rat-lookout": "Laporan pengamat (lookout): jenis objek, arah (lambung kiri/kanan) dan jarak.",
  "rat-mooring": "Laporan stasiun haluan: jumlah tali haluan dan spring yang sudah terikat, kapal tunda sudah terikat.",
  "rat-gangway": "Jaga tangga kapal: minta kartu identitas, catat tamu, dan panggil perwira jaga.",
  "eng-sounding": "Laporan sounding tangki pagi: nama tangki, nomor, sisi, volume atau persentase.",
  "vhf-anchor": "Laporan sudah berlabuh: area labuh mana dan berapa segel (shackle) rantai di air.",
};

const HI: Record<string, string> = {
  "vhf-tss": "VTS जहाज़ को एंकरेज पर जाने और एक ट्रैफ़िक लेन से दूर रहने का निर्देश दे रहा है। निर्देश को ठीक वैसे ही दोहराएँ (read back) और अंत में \"Over\" बोलें।",
  "vhf-crossing": "क्रॉसिंग स्थिति। दूसरे जहाज़ का संदेश स्वीकार करें और बताएँ कि आप अपना कोर्स और स्पीड बनाए रखेंगे।",
  "vhf-pilot": "पायलट आ रहा है। समय, जहाज़ की साइड (पोर्ट/स्टारबोर्ड) और पायलट लैडर की ऊँचाई दोहराएँ।",
  "eng-handover": "इंजन रूम वॉच हैंडओवर। मेन इंजन, जनरेटर/प्यूरीफ़ायर, प्रेशर और अलार्म की स्थिति बताएँ।",
  "eng-alarm": "कूलिंग वॉटर हाई टेम्परेचर अलार्म। ब्रिज को बताएँ समस्या क्या है और आप क्या कर रहे हैं (लोड कम, पंप चेक)।",
  "eng-bunker": "बार्ज से बंकरिंग पंपिंग रेट की पुष्टि करें। संख्या और इकाई (क्यूबिक मीटर प्रति घंटा) दोहराएँ।",
  "safe-fire": "इंजन रूम में आग। आग की जगह, क्रू मस्टरिंग और फ़ायर टीम तैयार है — बताएँ। \"Warning\" शब्द का प्रयोग करें।",
  "safe-mob": "आदमी समुद्र में गिरा। कौन सी साइड और लाइफ़बॉय फेंका गया — रिपोर्ट करें।",
  "safe-mayday": "Mayday संकट संदेश। जहाज़ का नाम, पोज़ीशन, स्थिति और लोगों की संख्या दोहराएँ।",
  "psc-ows": "PSC इंस्पेक्टर ऑयली वॉटर सेपरेटर के 15 ppm अलार्म के बारे में पूछ रहा है। टेस्ट और Oil Record Book में एंट्री समझाएँ।",
  "psc-enclosed": "बंद स्थान (enclosed space) में प्रवेश प्रक्रिया: परमिट, वेंटिलेशन, गैस/ऑक्सीजन टेस्ट, स्टैंडबाय व्यक्ति।",
  "psc-drill": "एबंडन शिप ड्रिल में अपनी ड्यूटी समझाएँ: मस्टर स्टेशन और आपका काम।",
  "rat-helm": "हेल्म ऑर्डर। अधिकारी का आदेश ठीक वैसे ही दोहराएँ (दिशा, डिग्री, कोर्स), फिर steady होने पर रिपोर्ट करें।",
  "rat-lookout": "लुकआउट रिपोर्ट: वस्तु का प्रकार, दिशा (पोर्ट/स्टारबोर्ड बो) और दूरी।",
  "rat-mooring": "फ़ॉरवर्ड स्टेशन रिपोर्ट: कितनी हेड लाइन और स्प्रिंग लाइन बंधी हैं, टग बंधा है।",
  "rat-gangway": "गैंगवे वॉच: पहचान पत्र माँगें, विज़िटर को लॉग करें और ड्यूटी ऑफ़िसर को बुलाएँ।",
  "eng-sounding": "सुबह की टैंक साउंडिंग रिपोर्ट: टैंक का नाम, नंबर, साइड, मात्रा या प्रतिशत।",
  "vhf-anchor": "एंकर होने की रिपोर्ट: कौन सा एंकरेज और पानी में कितने शैकल।",
};

export const HINTS: Record<HintLang, Record<string, string>> = { en: EN, vi: { ...VI_HINTS, ...VI_EXTRA }, id: ID, hi: HI };

export function defaultHintLang(nationality?: string | null): HintLang | null {
  const n = (nationality || "").toLowerCase();
  if (n.includes("viet")) return "vi";
  if (n.includes("indones")) return "id";
  if (n.includes("india")) return "hi";
  return null;
}
