# Reader prompt for the state statutes sweep

The session gives each small-model reader (Haiku) this prompt, one reader per batch, with the paths and the state note filled in. It wraps the reading instructions (reading-instructions.md in this folder), which stay the same for every state.

```
You are one reader in a sweep of a state's code for Indian law. Read {INSTRUCTIONS} first and follow it exactly.

Your batch is {BATCH} ({LINES} lines of JSON). Read it 10 lines at a time with sed (sed -n '1,10p' {BATCH}, then '11,20p', and so on to the last line). After each 10 lines, append your 10 answers to {ANSWERS} with a heredoc (cat >> {ANSWERS} <<'EOF' ... EOF): one JSON object per line, {"id": ..., "verdict": "core" | "incidental" | "none", "reason": "12 words or fewer"}, in the batch's order. Answer every line yourself; do not write a script or use keyword rules to judge them. Do not change the batch file and do not browse the web.

{STATE_NOTE}

When you are done, run wc -l {BATCH} {ANSWERS}; if the counts differ, find the ids you missed and append them. Reply with the two counts only.
```

State notes used so far:

- Alaska: a Native regional or village corporation under the Alaska Native Claims Settlement Act, an Alaska Native village or tribe and a Native allotment count as Native.
- Rhode Island: "Narragansett" alone is usually the town or the bay; it is the Narragansett Indian Tribe only when the text says tribe, Indian or nation.
- South Dakota, North Dakota and Minnesota: "Dakota" in "South Dakota" or "North Dakota" is the state, and "Sioux Falls" is a city; neither is a Native nation.
- Idaho: "Nez Perce", "Kootenai", "Shoshone", "Bannock" and "Benewah" are also county names; a county named for a nation is a place name only.
- Kansas: "Kansas", "Wichita", "Ottawa", "Shawnee", "Osage", "Miami", "Pottawatomie", "Wyandotte" and "Cherokee" are also county or city names; they are place names only unless the text speaks of the tribe or its people.
- Vermont: the state recognizes four Abenaki tribes (Elnu, Nulhegan, Koasek, Missisquoi); a state-recognized tribe counts as a Native nation. "Missisquoi" alone is often the river, bay or wildlife refuge, a place name only.
- New Jersey: the state recognizes three tribes (the Nanticoke Lenni-Lenape, the Powhatan Renape and the Ramapough Lenape); a state-recognized tribe counts as a Native nation. "Lenape" in the name of a school district, park, lake or road is a place name only, and "Delaware" is usually the state, river or bay.
- Pennsylvania: "Indiana" (the county or borough) and "Indian Creek" are place names only; "the Commonwealth" is the state.
- Connecticut: the Mashantucket Pequot Tribe and the Mohegan Tribe are federally recognized, and the state also recognizes the Schaghticoke, Paucatuck Eastern Pequot and Golden Hill Paugussett; all count as Native nations. "Pequot", "Mohegan" or "Quinnipiac" in the name of a road, river, bridge, university or town area is a place name only.
- Michigan: "Ottawa", "Chippewa" and "Menominee" are also county names and "Wyandotte" is a city; a county or city named for a nation is a place name only.
- Wyoming: "Cheyenne" is the state capital, and "Shoshone" and "Wind River" are also names of a national forest, a river, mountains and towns; they are place names only unless the text speaks of the tribes, the Wind River Indian Reservation or their people.
- Colorado: "Pueblo" is also a city and a county, and "Arapahoe", "Cheyenne", "Kiowa" and "Ute" are also names of counties, towns, creeks and passes; they are place names only unless the text speaks of a tribe, a pueblo as a Native community, or their people. Water law "reservations" of water are not Indian reservations.
- Wisconsin: "Menominee", "Oneida", "Winnebago" and "Chippewa" are also names of counties, cities, rivers and lakes, and "Stockbridge", "Lac du Flambeau" and "Red Cliff" are also town names; they are place names only unless the text speaks of a tribe, a reservation or their people. A few texts run the printed page's two columns together; judge from what is there.
- California: a "California Native American tribe" (a tribe on the Native American Heritage Commission's contact list, federally recognized or not), a rancheria and the Native American Heritage Commission count as Native. "Mono", "Modoc", "Shasta", "Yuba", "Tehama" and "Indian Wells" are also county or city names; a place named for a nation is a place name only.
- Utah: "Utah" is the state. The Navajo Nation, the Ute Indian Tribe of the Uintah and Ouray Reservation, the Paiute Indian Tribe of Utah, the Goshute tribes and the Northwestern Band of the Shoshone Nation are nations; "San Juan County" and "Uintah County" are counties.
- Florida: "Seminole" is also a county and a city, and "Indian River" a county and a lagoon; they are place names only unless the text speaks of the Seminole Tribe or Indians.
- Nebraska: "Omaha" is usually the city, and "Dakota", "Sioux", "Pawnee", "Otoe" and "Winnebago" are also county, city or village names; they are place names only unless the text speaks of the tribe or its people.
- Maine: the Passamaquoddy Tribe, the Penobscot Nation, the Houlton Band of Maliseet Indians and the Mi'kmaq Nation (Aroostook Band of Micmacs) are nations; "Penobscot" is also a county, river and bay and "Passamaquoddy" a bay, place names only unless the text speaks of the tribe or nation. "Indian territory" in Title 30 means the tribes' lands under the Maine Indian Claims Settlement.
- New York: "Seneca", "Oneida", "Onondaga", "Cayuga", "Allegany", "Cattaraugus", "Mohawk", "Montauk", "Tonawanda" and "Shinnecock" are also county, town, lake, river, inlet or road names, and "Niagara Mohawk" is a power company; they are place or company names only unless the text speaks of the nation, its reservation, its government or its people. "West Indian" and "Indian sub-continent" are not Native. The cite form is "<law id>:<section>": "IND" is the New York Indian Law, so every section of it is Indian law.
