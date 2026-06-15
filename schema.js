/**
 * schema.js — Universal structured data for rehabsrilanka.com
 * Injects JSON-LD automatically based on page type.
 * Schemas: Organization, WebSite, MedicalWebPage, FAQPage, BreadcrumbList
 */
(function () {
  'use strict';

  var DOMAIN = 'https://www.rehabsrilanka.com';
  var ORG_NAME = 'Rehab Sri Lanka';
  var ORG_DESC = 'Expert guidance and free advice on drug and alcohol rehabilitation in Sri Lanka. We help you find the right treatment and get into the right programme fast.';
  var ORG_PHONE = '+94763247711';
  var ORG_EMAIL = 'info@rehabsrilanka.com';
  var ORG_LOGO = DOMAIN + '/logo.png';

  var path = window.location.pathname.replace(/\/$/, '') || '/index.html';
  var slug = path.split('/').pop() || 'index.html';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function inject(schema) {
    var el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(schema, null, 0);
    document.head.appendChild(el);
  }

  function pageUrl() {
    return DOMAIN + (slug === 'index.html' ? '/' : '/' + slug);
  }

  function pageTitle() {
    var t = document.title || ORG_NAME;
    return t.replace(' | Rehab Sri Lanka', '').trim();
  }

  function pageDesc() {
    var m = document.querySelector('meta[name="description"]');
    return m ? m.getAttribute('content') : ORG_DESC;
  }

  // ── Organization (all pages) ───────────────────────────────────────────────
  inject({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': DOMAIN + '/#organization',
    name: ORG_NAME,
    url: DOMAIN,
    logo: {
      '@type': 'ImageObject',
      url: ORG_LOGO
    },
    description: ORG_DESC,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: ORG_PHONE,
        contactType: 'customer support',
        availableLanguage: 'English',
        contactOption: 'TollFree'
      },
      {
        '@type': 'ContactPoint',
        email: ORG_EMAIL,
        contactType: 'customer support'
      }
    ],
    sameAs: [
      'https://wa.me/94763247711'
    ],
    areaServed: 'Worldwide',
    serviceType: 'Drug and Alcohol Rehabilitation'
  });

  // ── WebSite + Sitelinks SearchBox (homepage only) ──────────────────────────
  if (slug === 'index.html' || slug === '') {
    inject({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': DOMAIN + '/#website',
      url: DOMAIN,
      name: ORG_NAME,
      description: ORG_DESC,
      publisher: { '@id': DOMAIN + '/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: DOMAIN + '/?s={search_term_string}'
        },
        'query-input': 'required name=search_term_string'
      }
    });
  }

  // ── BreadcrumbList (all inner pages) ──────────────────────────────────────
  if (slug && slug !== 'index.html') {
    var crumbItems = [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: DOMAIN + '/'
      }
    ];

    // City pages
    if (slug.startsWith('rehab-sri-lanka-from-')) {
      var city = slug
        .replace('rehab-sri-lanka-from-', '')
        .replace('.html', '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      crumbItems.push({
        '@type': 'ListItem',
        position: 2,
        name: 'From Your City',
        item: DOMAIN + '/index.html#from-your-city'
      });
      crumbItems.push({
        '@type': 'ListItem',
        position: 3,
        name: 'Rehab in Sri Lanka from ' + city,
        item: pageUrl()
      });
    }
    // Treatment pages
    else if (slug.indexOf('rehab') !== -1 || slug.indexOf('addiction') !== -1 ||
             slug.indexOf('treatment') !== -1 || slug.indexOf('diagnosis') !== -1 ||
             slug.indexOf('withdrawal') !== -1 || slug.indexOf('detox') !== -1) {
      crumbItems.push({
        '@type': 'ListItem',
        position: 2,
        name: 'Treatment',
        item: DOMAIN + '/alcohol-rehab-sri-lanka.html'
      });
      crumbItems.push({
        '@type': 'ListItem',
        position: 3,
        name: pageTitle(),
        item: pageUrl()
      });
    }
    // Blog pages
    else if (slug.startsWith('blog')) {
      crumbItems.push({
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: DOMAIN + '/blog.html'
      });
      crumbItems.push({
        '@type': 'ListItem',
        position: 3,
        name: pageTitle(),
        item: pageUrl()
      });
    }
    // Info / other pages
    else {
      crumbItems.push({
        '@type': 'ListItem',
        position: 2,
        name: pageTitle(),
        item: pageUrl()
      });
    }

    inject({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbItems
    });
  }

  // ── MedicalWebPage (treatment & information pages) ─────────────────────────
  var isTreatmentPage = (
    slug.indexOf('rehab') !== -1 ||
    slug.indexOf('addiction') !== -1 ||
    slug.indexOf('treatment') !== -1 ||
    slug.indexOf('diagnosis') !== -1 ||
    slug.indexOf('withdrawal') !== -1 ||
    slug.indexOf('detox') !== -1 ||
    slug.indexOf('burnout') !== -1 ||
    slug.indexOf('trauma') !== -1 ||
    slug.indexOf('anxiety') !== -1 ||
    slug.indexOf('depression') !== -1 ||
    slug.indexOf('luxury') !== -1 ||
    slug.indexOf('inpatient') !== -1 ||
    slug.indexOf('aftercare') !== -1 ||
    slug.indexOf('cost-of') !== -1 ||
    slug.indexOf('how-long') !== -1 ||
    slug.indexOf('what-to-expect') !== -1 ||
    slug.indexOf('safe-for') !== -1 ||
    slug.indexOf('family') !== -1 ||
    slug.indexOf('intervention') !== -1
  );

  if (isTreatmentPage && !slug.startsWith('blog')) {
    inject({
      '@context': 'https://schema.org',
      '@type': 'MedicalWebPage',
      '@id': pageUrl() + '#webpage',
      url: pageUrl(),
      name: pageTitle(),
      description: pageDesc(),
      about: {
        '@type': 'MedicalCondition',
        name: 'Substance Use Disorder'
      },
      publisher: { '@id': DOMAIN + '/#organization' },
      inLanguage: 'en',
      isPartOf: { '@id': DOMAIN + '/#website' }
    });
  }

  // ── MedicalBusiness / LocalBusiness for the clinic service ────────────────
  if (slug === 'index.html' || slug === '' || slug === 'contact.html') {
    inject({
      '@context': 'https://schema.org',
      '@type': ['MedicalBusiness', 'LocalBusiness'],
      '@id': DOMAIN + '/#business',
      name: ORG_NAME,
      url: DOMAIN,
      telephone: ORG_PHONE,
      email: ORG_EMAIL,
      description: ORG_DESC,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'LK',
        addressLocality: 'Colombo',
        addressRegion: 'Western Province'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 6.9271,
        longitude: 79.8612
      },
      priceRange: 'from $9,900 USD/month',
      currenciesAccepted: 'USD, GBP, EUR, AUD, AED',
      medicalSpecialty: 'Addiction Medicine',
      availableService: [
        { '@type': 'MedicalTherapy', name: 'Alcohol Rehabilitation' },
        { '@type': 'MedicalTherapy', name: 'Drug Rehabilitation' },
        { '@type': 'MedicalTherapy', name: 'Dual Diagnosis Treatment' },
        { '@type': 'MedicalTherapy', name: 'Medically Supervised Detox' },
        { '@type': 'MedicalTherapy', name: 'Trauma-Informed Care' },
        { '@type': 'MedicalTherapy', name: 'Cognitive Behavioural Therapy' }
      ],
      areaServed: {
        '@type': 'Place',
        name: 'Worldwide'
      }
    });
  }

  // ── FAQPage schema (reads FAQ items from DOM) ──────────────────────────────
  var faqItems = document.querySelectorAll('.faq-item');
  if (faqItems && faqItems.length > 0) {
    var questions = [];
    faqItems.forEach(function (item) {
      var q = item.querySelector('.faq-q');
      var a = item.querySelector('.faq-a');
      if (q && a) {
        var qText = q.textContent.replace(/\s*[\+\-]\s*$/, '').trim();
        var aText = a.textContent.trim();
        if (qText && aText) {
          questions.push({
            '@type': 'Question',
            name: qText,
            acceptedAnswer: {
              '@type': 'Answer',
              text: aText
            }
          });
        }
      }
    });

    if (questions.length > 0) {
      inject({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': pageUrl() + '#faqpage',
        url: pageUrl(),
        name: pageTitle() + ' — FAQ',
        mainEntity: questions
      });
    }
  }

  // ── City page: Service schema ──────────────────────────────────────────────
  if (slug.startsWith('rehab-sri-lanka-from-')) {
    var cityName = slug
      .replace('rehab-sri-lanka-from-', '')
      .replace('.html', '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });

    inject({
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': pageUrl() + '#service',
      name: 'Rehabilitation in Sri Lanka for ' + cityName + ' Residents',
      description: pageDesc(),
      provider: { '@id': DOMAIN + '/#organization' },
      serviceType: 'Residential Addiction Treatment',
      areaServed: {
        '@type': 'City',
        name: cityName
      },
      offers: {
        '@type': 'Offer',
        price: '9900',
        priceCurrency: 'USD',
        description: 'Residential rehabilitation programme, 28 days',
        url: pageUrl()
      }
    });
  }

  // -- Article / BlogPosting schema (individual blog article pages) -----------
  var articleBody = document.querySelector('.article-body');
  if (articleBody && !slug.startsWith('blog')) {
    var articleCat = document.querySelector('.article-cat');
    var catName = articleCat ? articleCat.textContent.trim() : 'Addiction and Rehab';

    var authorBox = document.querySelector('.author-box');
    var authorObj;
    if (authorBox) {
      var authorNameEl = authorBox.querySelector('.author-name');
      var authorLinkEl = authorBox.querySelector('.author-links a');
      authorObj = {
        '@type': 'Person',
        name: authorNameEl ? authorNameEl.textContent.trim() : ORG_NAME,
        url: authorLinkEl ? authorLinkEl.getAttribute('href') : DOMAIN
      };
    } else {
      authorObj = { '@type': 'Organization', name: ORG_NAME, url: DOMAIN };
    }

    var dpMeta = document.querySelector('meta[property="article:published_time"]');
    var dmMeta = document.querySelector('meta[property="article:modified_time"]');
    var wordCount = articleBody.innerText ? articleBody.innerText.split(/\s+/).filter(Boolean).length : 0;

    var articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': pageUrl() + '#article',
      url: pageUrl(),
      headline: pageTitle(),
      description: pageDesc(),
      articleSection: catName,
      inLanguage: 'en',
      publisher: { '@id': DOMAIN + '/#organization' },
      author: authorObj,
      isPartOf: { '@id': DOMAIN + '/#website' }
    };
    if (dpMeta) articleSchema.datePublished = dpMeta.getAttribute('content');
    if (dmMeta) articleSchema.dateModified = dmMeta.getAttribute('content');
    if (wordCount > 0) articleSchema.wordCount = wordCount;
    inject(articleSchema);
  }

})();
