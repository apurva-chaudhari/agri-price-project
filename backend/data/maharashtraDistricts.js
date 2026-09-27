/**
 * Maharashtra districts -> talukas (APMC-level administrative units) dataset.
 *
 * Taluka names for all 36 districts are sourced from the official list of
 * talukas of Maharashtra (govt. administrative divisions / Wikipedia).
 *
 * Village counts (villages: <number>) are filled in ONLY where they come
 * from a verifiable government source:
 *   - Amravati  : Census/Zilla Parishad figures
 *   - Pune      : Maharashtra Pollution Control Board, "General Features of
 *                 Pune District" (source: Census of India 2001 / District
 *                 Social & Economic Review)
 *   - Akola     : SECC (Socio Economic & Caste Census) district LGD report
 *
 * For the remaining districts, villages is left as `null` rather than
 * guessed — the UI shows "village count not available yet" for those,
 * which is an honest, documented limitation (same pattern as the crop-photo
 * recognition fallback) rather than fabricated data. This is easy to extend:
 * just fill in verified numbers from the state LGD portal
 * (mahavillages.mahabhumi.gov.in) as they become available.
 */

const DISTRICTS = {
  'Amravati': [
    { taluka: 'Chikhaldara', villages: 194 },
    { taluka: 'Achalpur', villages: 172 },
    { taluka: 'Chandurbazar', villages: 170 },
    { taluka: 'Morshi', villages: 167 },
    { taluka: 'Nandgaon Khandeshwar', villages: 161 },
    { taluka: 'Dharni', villages: 157 },
    { taluka: 'Daryapur', villages: 151 },
    { taluka: 'Warud', villages: 141 },
    { taluka: 'Bhatkuli', villages: 137 },
    { taluka: 'Amravati', villages: 130 },
    { taluka: 'Anjangaon Surji', villages: 128 },
    { taluka: 'Dhamangaon Railway', villages: 113 },
    { taluka: 'Tiosa', villages: 95 },
    { taluka: 'Chandur Railway', villages: 93 },
  ],
  'Pune': [
    { taluka: 'Bhor', villages: 195 },
    { taluka: 'Khed', villages: 186 },
    { taluka: 'Junnar', villages: 181 },
    { taluka: 'Maval', villages: 181 },
    { taluka: 'Ambegaon', villages: 143 },
    { taluka: 'Indapur', villages: 143 },
    { taluka: 'Mulshi', villages: 141 },
    { taluka: 'Velhe', villages: 128 },
    { taluka: 'Shirur', villages: 117 },
    { taluka: 'Baramati', villages: 117 },
    { taluka: 'Purandhar', villages: 107 },
    { taluka: 'Daund', villages: 103 },
    { taluka: 'Haveli', villages: 102 },
    { taluka: 'Pune City', villages: 0 }, // fully urban
  ],
  'Akola': [
    { taluka: 'Akola', villages: 196 },
    { taluka: 'Akot', villages: 180 },
    { taluka: 'Murtijapur', villages: 163 },
    { taluka: 'Telhara', villages: 101 },
    { taluka: 'Balapur', villages: 98 },
    { taluka: 'Patur', villages: 95 },
    { taluka: 'Barshitakli', villages: null },
  ],

  // --- Remaining districts: taluka names confirmed, village counts pending ---
  'Sindhudurg': ['Kankavli', 'Vaibhavwadi', 'Devgad', 'Malwan', 'Sawantwadi', 'Kudal', 'Vengurla', 'Dodamarg'].map(t => ({ taluka: t, villages: null })),
  'Ratnagiri': ['Ratnagiri', 'Sangameshwar', 'Lanja', 'Rajapur', 'Chiplun', 'Guhagar', 'Dapoli', 'Mandangad', 'Khed'].map(t => ({ taluka: t, villages: null })),
  'Raigad': ['Alibag', 'Pen', 'Murud', 'Panvel', 'Uran', 'Karjat', 'Khalapur', 'Mangaon', 'Tala', 'Roha', 'Sudhagad-Pali', 'Mahad', 'Poladpur', 'Shrivardhan', 'Mhasala'].map(t => ({ taluka: t, villages: null })),
  'Mumbai City': [{ taluka: 'Mumbai City', villages: 0 }],
  'Mumbai Suburban': ['Andheri', 'Bandra', 'Kurla', 'Borivali'].map(t => ({ taluka: t, villages: null })),
  'Thane': ['Thane', 'Kalyan', 'Murbad', 'Shahapur', 'Bhiwandi', 'Ulhasnagar', 'Ambarnath'].map(t => ({ taluka: t, villages: null })),
  'Palghar': ['Palghar', 'Vasai', 'Dahanu', 'Talasari', 'Jawhar', 'Mokhada', 'Vada', 'Vikramgad'].map(t => ({ taluka: t, villages: null })),
  'Nashik': ['Nashik', 'Igatpuri', 'Dindori', 'Peth', 'Trimbakeshwar', 'Kalwan', 'Deola', 'Surgana', 'Baglan', 'Malegaon', 'Nandgaon', 'Chandwad', 'Niphad', 'Sinnar', 'Yeola'].map(t => ({ taluka: t, villages: null })),
  'Nandurbar': ['Nandurbar', 'Navapur', 'Shahada', 'Talode', 'Akkalkuwa', 'Dhadgaon'].map(t => ({ taluka: t, villages: null })),
  'Dhule': ['Dhule', 'Sakri', 'Sindkheda', 'Shirpur'].map(t => ({ taluka: t, villages: null })),
  'Jalgaon': ['Jalgaon', 'Jamner', 'Erandol', 'Dharangaon', 'Bhusawal', 'Raver', 'Muktainagar', 'Bodwad', 'Yawal', 'Amalner', 'Parola', 'Chopda', 'Pachora', 'Bhadgaon', 'Chalisgaon'].map(t => ({ taluka: t, villages: null })),
  'Buldhana': ['Buldhana', 'Chikhli', 'Deulgaon Raja', 'Jalgaon Jamod', 'Sangrampur', 'Malkapur', 'Motala', 'Nandura', 'Khamgaon', 'Shegaon', 'Mehkar', 'Sindkhed Raja', 'Lonar'].map(t => ({ taluka: t, villages: null })),
  'Washim': ['Washim', 'Malegaon', 'Risod', 'Mangrulpir', 'Karanja', 'Manora'].map(t => ({ taluka: t, villages: null })),
  'Wardha': ['Wardha', 'Deoli', 'Seloo', 'Arvi', 'Ashti', 'Karanja', 'Hinganghat', 'Samudrapur'].map(t => ({ taluka: t, villages: null })),
  'Nagpur': ['Nagpur Urban', 'Nagpur Rural', 'Kamptee', 'Hingna', 'Katol', 'Narkhed', 'Savner', 'Kalameshwar', 'Ramtek', 'Mouda', 'Parseoni', 'Umred', 'Kuhi', 'Bhiwapur'].map(t => ({ taluka: t, villages: null })),
  'Bhandara': ['Bhandara', 'Tumsar', 'Pauni', 'Mohadi', 'Sakoli', 'Lakhani', 'Lakhandur'].map(t => ({ taluka: t, villages: null })),
  'Gondia': ['Gondia', 'Goregaon', 'Salekasa', 'Tiroda', 'Amgaon', 'Deori', 'Arjuni-Morgaon', 'Sadak-Arjuni'].map(t => ({ taluka: t, villages: null })),
  'Gadchiroli': ['Gadchiroli', 'Dhanora', 'Chamorshi', 'Mulchera', 'Desaiganj', 'Armori', 'Kurkheda', 'Korchi', 'Aheri', 'Etapalli', 'Bhamragad', 'Sironcha'].map(t => ({ taluka: t, villages: null })),
  'Chandrapur': ['Chandrapur', 'Saoli', 'Mul', 'Ballarpur', 'Pombhurna', 'Gondpimpri', 'Warora', 'Chimur', 'Bhadravati', 'Bramhapuri', 'Nagbhid', 'Sindewahi', 'Rajura', 'Korpana', 'Jiwati'].map(t => ({ taluka: t, villages: null })),
  'Yavatmal': ['Yavatmal', 'Arni', 'Babhulgaon', 'Kalamb', 'Darwha', 'Digras', 'Ner', 'Pusad', 'Umarkhed', 'Mahagaon', 'Kelapur', 'Ralegaon', 'Ghatanji', 'Wani', 'Maregaon', 'Zari Jamani'].map(t => ({ taluka: t, villages: null })),
  'Nanded': ['Nanded', 'Ardhapur', 'Mudkhed', 'Bhokar', 'Umri', 'Loha', 'Kandhar', 'Kinwat', 'Himayatnagar', 'Hadgaon', 'Mahur', 'Deglur', 'Mukhed', 'Dharmabad', 'Biloli', 'Naigaon'].map(t => ({ taluka: t, villages: null })),
  'Hingoli': ['Hingoli', 'Sengaon', 'Kalamnuri', 'Basmath', 'Aundha Nagnath'].map(t => ({ taluka: t, villages: null })),
  'Parbhani': ['Parbhani', 'Sonpeth', 'Gangakhed', 'Palam', 'Purna', 'Sailu', 'Jintur', 'Manwath', 'Pathri'].map(t => ({ taluka: t, villages: null })),
  'Jalna': ['Jalna', 'Bhokardan', 'Jafrabad', 'Badnapur', 'Ambad', 'Ghansawangi', 'Partur', 'Mantha'].map(t => ({ taluka: t, villages: null })),
  'Chhatrapati Sambhajinagar': ['Aurangabad', 'Kannad', 'Soegaon', 'Sillod', 'Phulambri', 'Khuldabad', 'Vaijapur', 'Gangapur', 'Paithan'].map(t => ({ taluka: t, villages: null })),
  'Beed': ['Beed', 'Georai', 'Patoda', 'Shirur-Kasar', 'Ashti', 'Majalgaon', 'Wadwani', 'Kaij', 'Dharur', 'Parli', 'Ambajogai'].map(t => ({ taluka: t, villages: null })),
  'Latur': ['Latur', 'Renapur', 'Ausa', 'Ahmedpur', 'Jalkot', 'Chakur', 'Shirur Anantpal', 'Nilanga', 'Deoni', 'Udgir'].map(t => ({ taluka: t, villages: null })),
  'Dharashiv': ['Osmanabad', 'Tuljapur', 'Bhum', 'Paranda', 'Washi', 'Kalamb', 'Lohara', 'Umarga'].map(t => ({ taluka: t, villages: null })),
  'Solapur': ['Barshi', 'Solapur North', 'Solapur South', 'Akkalkot', 'Madha', 'Karmala', 'Pandharpur', 'Mohol', 'Malshiras', 'Sangole', 'Mangalvedhe'].map(t => ({ taluka: t, villages: null })),
  'Ahmednagar': ['Ahmednagar', 'Shevgaon', 'Pathardi', 'Parner', 'Sangamner', 'Kopargaon', 'Akole', 'Shrirampur', 'Nevasa', 'Rahata', 'Rahuri', 'Shrigonda', 'Karjat', 'Jamkhed'].map(t => ({ taluka: t, villages: null })),
  'Satara': ['Satara', 'Jaoli', 'Koregaon', 'Wai', 'Mahabaleshwar', 'Khandala', 'Phaltan', 'Maan', 'Khatav', 'Patan', 'Karad'].map(t => ({ taluka: t, villages: null })),
  'Sangli': ['Miraj', 'Kavathemahankal', 'Tasgaon', 'Jat', 'Walwa', 'Shirala', 'Khanapur', 'Atpadi', 'Palus', 'Kadegaon'].map(t => ({ taluka: t, villages: null })),
  'Kolhapur': ['Karvir', 'Panhala', 'Shahuwadi', 'Kagal', 'Hatkanangale', 'Shirol', 'Radhanagari', 'Gaganbawada', 'Bhudargad', 'Gadhinglaj', 'Chandgad', 'Ajra'].map(t => ({ taluka: t, villages: null })),
};

module.exports = { DISTRICTS };
