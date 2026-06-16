import re
import time
import logging
import xml.etree.ElementTree as ET
import requests
from flask import Flask, jsonify, render_template, request

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for parsed release notes
# Cache structure: {'data': list, 'expiry': float}
cache = {'data': None, 'expiry': 0}
CACHE_DURATION = 600  # 10 minutes cache duration

def parse_html_content(html_content):
    """
    Parses the CDATA HTML content from a feed entry.
    Splits the content by <h3> category tags and groups the descriptions.
    """
    items = []
    # Match <h3>[Category]</h3> followed by content up to the next <h3> or end of string
    pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', re.DOTALL)
    matches = pattern.findall(html_content)
    
    for category, content in matches:
        category_cleaned = category.strip()
        content_cleaned = content.strip()
        
        # Determine a CSS class or semantic type based on category
        category_lower = category_cleaned.lower()
        if 'feature' in category_lower:
            tag_type = 'feature'
        elif 'breaking' in category_lower:
            tag_type = 'breaking'
        elif 'change' in category_lower:
            tag_type = 'change'
        elif 'issue' in category_lower:
            tag_type = 'issue'
        elif 'deprecation' in category_lower:
            tag_type = 'deprecation'
        else:
            tag_type = 'announcement'
            
        items.append({
            'category': category_cleaned,
            'type': tag_type,
            'html': content_cleaned
        })
        
    if not items:
        # Fallback if no <h3> tags are found
        items.append({
            'category': 'Announcement',
            'type': 'announcement',
            'html': html_content.strip()
        })
        
    return items

def fetch_and_parse_feed():
    """
    Fetches the Atom feed and parses it into a structured list of entries.
    """
    logging.info(f"Fetching feed from {FEED_URL}")
    response = requests.get(FEED_URL, timeout=10)
    response.raise_for_status()
    
    # Parse XML
    # Using ElementTree to parse Atom feed
    # Note: Atom namespace is http://www.w3.org/2005/Atom
    root = ET.fromstring(response.content)
    
    # Define namespace map for Atom
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    for entry_elem in root.findall('atom:entry', ns):
        title_elem = entry_elem.find('atom:title', ns)
        id_elem = entry_elem.find('atom:id', ns)
        updated_elem = entry_elem.find('atom:updated', ns)
        link_elem = entry_elem.find("atom:link[@rel='alternate']", ns)
        content_elem = entry_elem.find('atom:content', ns)
        
        title = title_elem.text if title_elem is not None else "Unknown Date"
        entry_id = id_elem.text if id_elem is not None else ""
        updated = updated_elem.text if updated_elem is not None else ""
        link = link_elem.attrib.get('href', '') if link_elem is not None else ""
        
        html_content = ""
        if content_elem is not None:
            # Atom content can be text or HTML
            html_content = content_elem.text or ""
            
        # Parse notes inside this entry
        notes = parse_html_content(html_content)
        
        entries.append({
            'id': entry_id,
            'title': title,
            'updated': updated,
            'link': link,
            'notes': notes
        })
        
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    if force_refresh or cache['data'] is None or now > cache['expiry']:
        try:
            releases = fetch_and_parse_feed()
            cache['data'] = releases
            cache['expiry'] = now + CACHE_DURATION
            logging.info("Cached release notes refreshed successfully.")
        except Exception as e:
            logging.error(f"Error fetching or parsing feed: {e}")
            # If fetch fails but we have stale cache, return stale cache
            if cache['data'] is not None:
                logging.warning("Serving stale cache data due to fetch failure.")
                return jsonify({
                    'status': 'stale',
                    'error': str(e),
                    'releases': cache['data']
                })
            return jsonify({
                'status': 'error',
                'error': f"Failed to fetch release notes: {str(e)}"
            }), 500
            
    return jsonify({
        'status': 'success',
        'releases': cache['data']
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
