"""Check every quote in the drafted people against the opinion text, page by page."""
import json, re, sys, glob, os

S = os.environ.get('BIOGRAPHY_WORK', os.path.dirname(os.path.abspath(__file__)))  # the working folder with cases/, drafts/, treaty-drafts/ and the map files


def norm(text):
    text = text.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    text = re.sub(r'-\s*\n\s*', '-', text)
    text = re.sub(r'\s+', ' ', text)
    return text.lower().strip()


def pages_of(cite):
    v, p = re.match(r'(\d+) U\.S\. (\d+)', cite).groups()
    path = f"{S}/cases/{v}-{p}.txt"
    if not os.path.exists(path):
        return None
    pages = open(path, errors='ignore').read().split('\f')
    return {int(p) + i: norm(t) for i, t in enumerate(pages)}


def found(pages, q):
    if not q or not q.get('quote'):
        return False
    quote = norm(q['quote'])
    page = q.get('page')
    if page in pages and quote in pages[page]:
        return True
    # Allow a hyphenated word joined or kept, and the quote's page off by the layout's header.
    alt = quote.replace('- ', '-').replace('-', '')
    return page in pages and alt in pages[page].replace('- ', '-').replace('-', '')


def main(files):
    good, bad, excluded = [], [], []
    for f in files:
        for person in json.load(open(f)):
            if not person.get('include'):
                excluded.append(person)
                continue
            pages = pages_of(person['cite'])
            problems = []
            for field in ('native', 'nation', 'role_quote'):
                if not found(pages, person.get(field)):
                    problems.append(field)
            if person.get('result') and not found(pages, person.get('result_quote')):
                problems.append('result_quote')
            person['events'] = [e for e in person.get('events') or [] if found(pages, e) or problems.append('event: ' + e.get('text', '')[:40])]
            person['other_names'] = [n for n in person.get('other_names') or [] if found(pages, n) or problems.append('other name: ' + n.get('name', ''))]
            person['problems'] = problems
            (good if not any(p in ('native', 'role_quote') for p in problems) else bad).append(person)
    return good, bad, excluded


if __name__ == '__main__':
    files = sorted(glob.glob(f"{S}/drafts/batch-*.json"))
    good, bad, excluded = main(files)
    json.dump(good, open(f"{S}/drafts/checked-good.json", 'w'), indent=1)
    json.dump(bad, open(f"{S}/drafts/checked-bad.json", 'w'), indent=1)
    print(f"included and checked {len(good)}, failed core quotes {len(bad)}, excluded {len(excluded)}")
    minor = sum(1 for p in good if p['problems'])
    print(f"of the checked, {minor} lost a nation/result/event/other-name quote")
