// Label/artist roster. Coordinates use a 1920×1080 design viewport.
// Each label has 1-N concentric "rings"; each ring orbits at `speed`
// (degrees per second; negative reverses direction).
// Edit names, descriptions, debut/members here to update the visualization.

window.ORBITAL_DATA = {
  org: "HYBE MUSIC GROUP APAC",
  region: "ASIA-PACIFIC",
  tagline: "Nine labels · One gravity well",

  labels: [
    // BELIFT LAB — ILLIT (inner), ENHYPEN (outer)
    {
      id: "belift",
      name: "BELIFT LAB",
      logo: "logos/belift.png", logoRatio: 3.291,
      cx: 353, cy: 254,
      founded: 2018,
      hq: "Seoul",
      acts: 2,
      joined: "2023",
      description: "Established as a joint venture label between CJ ENM and BIGHIT MUSIC. Home to ILLIT and ENHYPEN.",
      rings: [
        { r: 130, speed: 22, artists: [
          { id: "enhypen", name: "ENHYPEN", members: 6, debut: 2020, genre: "K-pop",
            fandom: "ENGENE", latest: "—", leader: "Jungwon",
            roster: ["Jay (2002)","Jake (2002)","Sunghoon (2002)","Sunoo (2003)","Jungwon (2004)","Ni-ki (2005)"],
            bio: "Six-member boy group. Debuted November 2020.",
            angle: 130 }
        ]},
        { r: 230, speed: -14, artists: [
          { id: "illit", name: "ILLIT", members: 5, debut: 2024, genre: "K-pop",
            fandom: "GLLIT", latest: "—", leader: "Yunah",
            roster: ["Yunah (2004)","Minju (2004)","Moka (2004)","Wonhee (2007)","Iroha (2008)"],
            bio: "Five-member girl group. Debuted March 2024.",
            angle: 245 }
        ]}
      ]
    },

    // JCONIC — aoen
    {
      id: "jconic",
      name: "JCONIC",
      logo: "logos/jconic.png", logoRatio: 3.547,
      cx: 846, cy: 366,
      founded: 2024,
      hq: "Tokyo",
      acts: 1,
      joined: "Founded by HYBE Japan",
      description: "Home to aoen.",
      rings: [
        { r: 150, speed: 18, artists: [
          { id: "aoen", name: "aoen", members: 1, debut: 2024, genre: "J-Pop",
            fandom: "aoring", latest: "—", leader: "Yuju",
            roster: ["Yuju (2002)","Ruka (2003)","Gaku (2004)","HIKARU (2005)","Sota (2005)","Kyosuke (2005)","Reo (2007)"],
            bio: "Seven-member boy group. Debuted June 2025.",
            angle: 80 }
        ]}
      ]
    },

    // BIGHIT MUSIC — CORTIS (inner), TXT, BTS (outer)
    {
      id: "bighit",
      name: "BIGHIT MUSIC",
      logo: "logos/bighit.png", logoRatio: 1.605,
      cx: 1525, cy: 315,
      founded: 2005,
      hq: "Seoul",
      acts: 3,
      joined: "Predecessor of HYBE",
      description: "Home to CORTIS, TOMORROW X TOGETHER, and BTS.",
      rings: [
        { r: 110, speed: 28, artists: [
          { id: "bts", name: "BTS", members: 7, debut: 2013, genre: "K-pop",
            fandom: "ARMY", latest: "—", leader: "RM",
            roster: ["Jin (1992)","SUGA (1993)","j-hope (1994)","RM (1994)","Jimin (1995)","V (1995)","Jungkook (1997)"],
            bio: "Seven-member boy group. Debuted June 2013.",
            angle: 35 }
        ]},
        { r: 210, speed: -18, artists: [
          { id: "txt", name: "TOMORROW X TOGETHER", members: 5, debut: 2019, genre: "K-pop",
            fandom: "MOA", latest: "—", leader: "Soobin",
            roster: ["Yeonjun (1999)","Soobin (2000)","Beomgyu (2001)","Taehyun (2002)","Huening Kai (2002)"],
            bio: "Five-member boy group. Debuted March 2019.",
            angle: 320 }
        ]},
        { r: 310, speed: 11, artists: [
          { id: "cortis", name: "CORTIS", members: 5, debut: 2025, genre: "K-pop",
            fandom: "COER", latest: "—", leader: "Martin",
            roster: ["James (2005)","Seonghyeon (2007)","Martin (2008)","Juhoon (2008)","Keonho (2009)"],
            bio: "Five-member boy group. Debuted August 2025.",
            angle: 160 }
        ]}
      ]
    },

    // YX LABELS — &TEAM
    {
      id: "yx",
      name: "YX LABELS",
      logo: "logos/yx.png", logoRatio: 3.07,
      cx: 977, cy: 170,
      founded: 2017,
      hq: "Tokyo",
      acts: 1,
      joined: "Founded by HYBE Japan",
      description: "Home to &TEAM.",
      rings: [
        { r: 150, speed: -20, artists: [
          { id: "andteam", name: "&TEAM", members: 9, debut: 2022, genre: "J-pop / K-pop",
            fandom: "LUNÉ", latest: "—", leader: "EJ",
            roster: ["K (1997)","Fuma (1998)","EJ (2002)","Nicholas (2002)","Yuma (2004)","Jo (2004)","Harua (2005)","Taki (2005)","Maki (2006)"],
            bio: "Nine-member boy group. Debuted December 2022.",
            angle: 65 }
        ]}
      ]
    },

    // ADOR — NewJeans
    {
      id: "ador",
      name: "ADOR",
      logo: "logos/ador.png", logoRatio: 2.121,
      cx: 240, cy: 721,
      founded: 2021,
      hq: "Seoul",
      acts: 1,
      joined: "Founded by HYBE",
      description: "Home to NewJeans.",
      rings: [
        { r: 150, speed: 16, artists: [
          { id: "newjeans", name: "NewJeans", members: 5, debut: 2022, genre: "K-pop",
            fandom: "Bunnies", latest: "—",
            roster: ["Minji (2004)","Hanni (2004)","Danielle (2005)","Haerin (2006)","Hyein (2008)"],
            bio: "Five-member girl group. Debuted July 2022.",
            angle: 30 }
        ]}
      ]
    },

    // PLEDIS Entertainment — TWS (inner), SEVENTEEN (outer)
    {
      id: "pledis",
      name: "PLEDIS ENT.",
      logo: "logos/pledis.png", logoRatio: 2.93,
      cx: 692, cy: 854,
      founded: 2007,
      hq: "Seoul",
      acts: 2,
      joined: "2020",
      description: "Home to TWS and SEVENTEEN.",
      rings: [
        { r: 130, speed: 19, artists: [
          { id: "seventeen", name: "SEVENTEEN", members: 13, debut: 2015, genre: "K-pop",
            fandom: "CARAT", latest: "—", leader: "S.Coups",
            roster: ["S.Coups (1995)","Jeonghan (1995)","Joshua (1995)","Jun (1996)","Hoshi (1996)","Wonwoo (1996)","Woozi (1996)","DK (1997)","Mingyu (1997)","The8 (1997)","Seungkwan (1998)","Vernon (1998)","Dino (1999)"],
            bio: "Thirteen-member boy group. Debuted May 2015.",
            angle: 50 }
        ]},
        { r: 230, speed: -10, artists: [
          { id: "tws", name: "TWS", members: 6, debut: 2024, genre: "K-pop",
            fandom: "42", latest: "—", leader: "Shinyu",
            roster: ["Shinyu (2003)","Dohoon (2005)","Youngjae (2005)","Hanjin (2006)","Jihoon (2006)","Kyungmin (2007)"],
            bio: "Six-member boy group. Debuted January 2024.",
            angle: 290 }
        ]}
      ]
    },

    // SOURCE MUSIC — LE SSERAFIM
    {
      id: "source",
      name: "SOURCE MUSIC",
      logo: "logos/source.png", logoRatio: 4.634,
      cx: 1237, cy: 916,
      founded: 2009,
      hq: "Seoul",
      acts: 1,
      joined: "2019",
      description: "Home to LE SSERAFIM.",
      rings: [
        { r: 150, speed: -17, artists: [
          { id: "lesserafim", name: "LE SSERAFIM", members: 5, debut: 2022, genre: "K-pop",
            fandom: "FEARNOT", latest: "—", leader: "Kim Chaewon",
            roster: ["Sakura (1998)","Kim Chaewon (2000)","Huh Yunjin (2001)","Kazuha (2003)","Hong Eunchae (2006)"],
            bio: "Five-member girl group. Debuted May 2022.",
            angle: 0 }
        ]}
      ]
    },

    // KOZ Entertainment — BOYNEXTDOOR
    {
      id: "koz",
      name: "KOZ ENT.",
      logo: "logos/koz.png", logoRatio: 1.71,
      cx: 1653, cy: 841,
      founded: 2018,
      hq: "Seoul",
      acts: 1,
      joined: "2020",
      description: "Home to BOYNEXTDOOR.",
      rings: [
        { r: 150, speed: 21, artists: [
          { id: "boynextdoor", name: "BOYNEXTDOOR", members: 6, debut: 2023, genre: "K-pop",
            fandom: "ONEDOOR", latest: "—", leader: "Jaehyun",
            roster: ["Sungho (2003)","Riwoo (2003)","Jaehyun (2003)","Taesan (2004)","Leehan (2004)","Woonhak (2006)"],
            bio: "Six-member boy group. Debuted May 2023.",
            angle: 270 }
        ]}
      ]
    },

    // ABD — coming soon
    {
      id: "abd",
      name: "ABD",
      logo: "logos/abd.png", logoRatio: 1.604,
      cx: 1095, cy: 607,
      founded: 2026,
      hq: "Seoul",
      acts: 0,
      comingSoon: true,
      ringR: 62,
      joined: "Founded by HYBE",
      description: "New Girl group-focused label",
      rings: []
    }
  ]
};
