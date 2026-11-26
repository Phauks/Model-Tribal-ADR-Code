/**
 * Who was President on a given day, for an executive order's page
 * (src/lib/server/law-pages.ts). Each term starts on the day the President
 * took office, as the Library of Congress's chronological list of Presidents
 * and the Joint Congressional Committee on Inaugural Ceremonies give them
 * (the sources content/supreme-court/people.yaml already cites): March 4 until
 * 1933, January 20 since, and the day a Vice President took the oath after a
 * President died or resigned. The key is the President's page under
 * /supreme-court/presidents/ where one exists; the four Presidents who
 * appointed no Justice have no page there.
 */
export interface PresidentTerm {
	name: string;
	key: string;
	/** The first day in office, YYYY-MM-DD. */
	from: string;
}

export const presidentTerms: readonly PresidentTerm[] = [
	{ name: 'George Washington', key: 'george-washington', from: '1789-04-30' },
	{ name: 'John Adams', key: 'john-adams', from: '1797-03-04' },
	{ name: 'Thomas Jefferson', key: 'thomas-jefferson', from: '1801-03-04' },
	{ name: 'James Madison', key: 'james-madison', from: '1809-03-04' },
	{ name: 'James Monroe', key: 'james-monroe', from: '1817-03-04' },
	{ name: 'John Quincy Adams', key: 'john-quincy-adams', from: '1825-03-04' },
	{ name: 'Andrew Jackson', key: 'andrew-jackson', from: '1829-03-04' },
	{ name: 'Martin Van Buren', key: 'martin-van-buren', from: '1837-03-04' },
	{ name: 'William Henry Harrison', key: 'william-henry-harrison', from: '1841-03-04' },
	{ name: 'John Tyler', key: 'john-tyler', from: '1841-04-04' },
	{ name: 'James K. Polk', key: 'james-k-polk', from: '1845-03-04' },
	{ name: 'Zachary Taylor', key: 'zachary-taylor', from: '1849-03-05' },
	{ name: 'Millard Fillmore', key: 'millard-fillmore', from: '1850-07-10' },
	{ name: 'Franklin Pierce', key: 'franklin-pierce', from: '1853-03-04' },
	{ name: 'James Buchanan', key: 'james-buchanan', from: '1857-03-04' },
	{ name: 'Abraham Lincoln', key: 'abraham-lincoln', from: '1861-03-04' },
	{ name: 'Andrew Johnson', key: 'andrew-johnson', from: '1865-04-15' },
	{ name: 'Ulysses Grant', key: 'ulysses-grant', from: '1869-03-04' },
	{ name: 'Rutherford B. Hayes', key: 'rutherford-b-hayes', from: '1877-03-04' },
	{ name: 'James A. Garfield', key: 'james-a-garfield', from: '1881-03-04' },
	{ name: 'Chester A. Arthur', key: 'chester-a-arthur', from: '1881-09-20' },
	{ name: 'Grover Cleveland', key: 'grover-cleveland', from: '1885-03-04' },
	{ name: 'Benjamin Harrison', key: 'benjamin-harrison', from: '1889-03-04' },
	{ name: 'Grover Cleveland', key: 'grover-cleveland', from: '1893-03-04' },
	{ name: 'William McKinley', key: 'william-mckinley', from: '1897-03-04' },
	{ name: 'Theodore Roosevelt', key: 'theodore-roosevelt', from: '1901-09-14' },
	{ name: 'William H. Taft', key: 'william-h-taft', from: '1909-03-04' },
	{ name: 'Woodrow Wilson', key: 'woodrow-wilson', from: '1913-03-04' },
	{ name: 'Warren G. Harding', key: 'warren-g-harding', from: '1921-03-04' },
	{ name: 'Calvin Coolidge', key: 'calvin-coolidge', from: '1923-08-03' },
	{ name: 'Herbert Hoover', key: 'herbert-hoover', from: '1929-03-04' },
	{ name: 'Franklin D. Roosevelt', key: 'franklin-d-roosevelt', from: '1933-03-04' },
	{ name: 'Harry S Truman', key: 'harry-s-truman', from: '1945-04-12' },
	{ name: 'Dwight D. Eisenhower', key: 'dwight-d-eisenhower', from: '1953-01-20' },
	{ name: 'John F. Kennedy', key: 'john-f-kennedy', from: '1961-01-20' },
	{ name: 'Lyndon B. Johnson', key: 'lyndon-b-johnson', from: '1963-11-22' },
	{ name: 'Richard M. Nixon', key: 'richard-m-nixon', from: '1969-01-20' },
	{ name: 'Gerald Ford', key: 'gerald-ford', from: '1974-08-09' },
	{ name: 'Jimmy Carter', key: 'jimmy-carter', from: '1977-01-20' },
	{ name: 'Ronald Reagan', key: 'ronald-reagan', from: '1981-01-20' },
	{ name: 'George H.W. Bush', key: 'george-h-w-bush', from: '1989-01-20' },
	{ name: 'William J. Clinton', key: 'william-j-clinton', from: '1993-01-20' },
	{ name: 'George W. Bush', key: 'george-w-bush', from: '2001-01-20' },
	{ name: 'Barack Obama', key: 'barack-obama', from: '2009-01-20' },
	{ name: 'Donald J. Trump', key: 'donald-j-trump', from: '2017-01-20' },
	{ name: 'Joseph R. Biden', key: 'joseph-r-biden', from: '2021-01-20' },
	{ name: 'Donald J. Trump', key: 'donald-j-trump', from: '2025-01-20' }
];

/**
 * The President in office on a full date (YYYY-MM-DD). An inauguration day
 * goes to the incoming President, who signs that day's orders. A date
 * without a month and day names nobody, since a year can have two.
 */
export function presidentOn(date: string | undefined): PresidentTerm | undefined {
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < presidentTerms[0].from) return undefined;
	return presidentTerms.findLast((term) => term.from <= date);
}
