const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface FeedItem {
  title: string;
  summary: string;
  pubDate: string;
  link: string;
}

function extractText(xml: string, tag: string): string {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'");
}

function parseRSS(xml: string, limit: number = 5): FeedItem[] {
  const items: FeedItem[] = [];
  
  // Split by <item> tags
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];
    const title = extractText(itemXml, 'title');
    const description = extractText(itemXml, 'description');
    const pubDate = extractText(itemXml, 'pubDate');
    const link = extractText(itemXml, 'link');
    
    // Clean summary - strip HTML tags, limit length
    const summary = decodeEntities(
      description.replace(/<[^>]+>/g, '')
    ).substring(0, 200).trim();
    
    if (title) {
      items.push({ title, summary, pubDate, link });
    }
  }
  
  return items;
}

// Also handle Atom feeds
function parseAtom(xml: string, limit: number = 5): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null && items.length < limit) {
    const entryXml = match[1];
    const title = extractText(entryXml, 'title');
    const summary = extractText(entryXml, 'summary') || extractText(entryXml, 'content');
    const pubDate = extractText(entryXml, 'published') || extractText(entryXml, 'updated');
    
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"[^>]*\/?>|<link[^>]*>([^<]*)<\/link>/i);
    const link = linkMatch ? (linkMatch[1] || linkMatch[2] || '') : '';
    
    const cleanSummary = summary
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .substring(0, 200)
      .trim();
    
    if (title) {
      items.push({ title, summary: cleanSummary, pubDate, link });
    }
  }
  
  return items;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedUrl, limit = 5 } = await req.json();

    if (!feedUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'feedUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching RSS feed:', feedUrl);

    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'SeaMinds/1.0 RSS Reader',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
    });

    if (!response.ok) {
      console.error(`Feed fetch failed [${response.status}]:`, feedUrl);
      return new Response(
        JSON.stringify({ success: false, error: `Feed returned status ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xml = await response.text();
    
    // Determine if Atom or RSS
    let items: FeedItem[];
    if (xml.includes('<feed') && xml.includes('<entry')) {
      items = parseAtom(xml, limit);
    } else {
      items = parseRSS(xml, limit);
    }

    console.log(`Parsed ${items.length} items from ${feedUrl}`);

    return new Response(
      JSON.stringify({ success: true, items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('RSS feed error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch feed';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
