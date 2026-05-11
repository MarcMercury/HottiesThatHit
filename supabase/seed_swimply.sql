-- AUTO-GENERATED from swimply.com private tennis court listings.
-- Source script: scripts/build_swimply_seed.py
-- Private host rentals; exact addresses are revealed only after booking,
-- so lat/lng/address are null. Listings are tied to LA metro radius search.

alter table hotties.facilities
  add column if not exists price_per_hour numeric,
  add column if not exists max_guests integer,
  add column if not exists rating numeric,
  add column if not exists reviews_count integer,
  add column if not exists listing_type text,
  add column if not exists cover_image_url text,
  add column if not exists description text;

insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values
  ('swimply', 'Swimply', 'https://swimply.com/explore/santa-monica-ca-us/tennis-court', 'custom', false,
   'Private host rentals. Address revealed only after booking. Hourly pricing.')
on conflict (id) do update set
  name = excluded.name,
  booking_url = excluded.booking_url,
  notes = excluded.notes;

insert into hotties.facilities
  (source_id, external_id, name, address, city, lat, lng, num_courts, surface,
   lights, active, category, region, online_booking, facility_booking_url, metro,
   price_per_hour, max_guests, rating, reviews_count, listing_type,
   cover_image_url, description)
values
  ('swimply', 'swimply:49682', 'Beverly Hills Pink Tennis Court', null, 'Beverly Hills', null, null, 1, null, false, true, 'Private Rental', 'Beverly Hills', true, 'https://swimply.com/p/49682', 'LA', 344.0, 100, 4.9, 40, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/1747092975372-IMG_6003.HEIC', 'An iconic court — pink, private, palm-lined, and perfectly Beverly Hills.

Just steps from the legendary Beverly Hills Hotel, this private tennis court offers a stunning setting beneath the palm-lined skies of Sunset Boulevard. Freshly resurfaced and beautifully maintained, it’s available for tennis lessons, live ball, private matches, events, and photo or film shoots.

The soft pink walls and deep green court create a bold, cinematic backdrop — perfect for everything from high-end fashion editorials and luxury brand campaigns to influencer content and lifestyle shoots. Whether you''re here to play or produce, this one-of-a-kind space delivers a distinct visual identity and an unforgettable Beverly Hills, 90210 experience.

Looking forward to hosting you! 
- Sebastian Moftakhar

A PLUTO Hospitality Concept'),
  ('swimply', 'swimply:64028', 'BEVERLY HILLS ROOFTOP TENNIS COURT', null, 'West Hollywood', null, null, 1, null, false, true, 'Private Rental', 'West Hollywood', true, 'https://swimply.com/p/64028', 'LA', 46.0, 10, 4.8, 70, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/1705341266495-Screenshot 2024-01-10 at 2.52.34 PM.jpg', 'Welcome to the LVBL Tennis Club - LA''s chicest place to play tennis. Located in the heart of Beverly Hills, introducing the best tennis experience in LA. You can order drinks by the court or the pool, have brunch, late night snacks, and hangout on the rooftop with stunning views of the Hollywood Hills. Enjoy all of these amazing amenities with your booking. This is a one of a kind tennis experience.

PARKING: $5 Self park, $10 Valet

For any parties or events please contact COACH@LVBL.CLUB 

ALL PLAYERS ON COURT MUST COMPLETE OUR WAIVER: https://lvbl.club/products/swimply-x-lvbl-court-waiver

PLEASE NO OUTSIDE FOOD AND BEVERAGE ALLOWED. BAR AND RESTAURANT ON-SITE

PLEASE NOTE, YOUR COURT REQUEST NEEDS TO BE APPROVED/CONFIRMED BY US BEFORE YOUR RESERVATION IS LOCKED IN, AND YOUR ACCOUNT IS CHARGED. THANKS

This booking is for play only. Any photo shoot or film production of any kind needs to be booked separately.'),
  ('swimply', 'swimply:61809', 'Le Parc Hotel Tennis Court', null, 'West Hollywood', null, null, 1, null, false, true, 'Private Rental', 'West Hollywood', true, 'https://swimply.com/p/61809', 'LA', 46.0, 12, 4.8, 30, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/61809-cover3149439601694799001.jpeg', 'Welcome to the LVBL Tennis Club - LA''s chicest place to play tennis. Located in the heart of Beverly Hills, introducing the best tennis experience in LA. You can order drinks by the court or the pool, have brunch, late night snacks, and hangout on the rooftop with stunning views of the Hollywood Hills. Enjoy all of these amazing amenities with your booking. This is a one of a kind tennis experience.

PARKING: $5 Self park, $10 Valet

For any parties or events please contact COACH@LVBL.CLUB 

ALL PLAYERS ON COURT MUST COMPLETE OUR WAIVER: https://lvbl.club/products/swimply-x-lvbl-court-waiver

PLEASE NO OUTSIDE FOOD AND BEVERAGE ALLOWED. BAR AND RESTAURANT ON-SITE

PLEASE NOTE, YOUR COURT REQUEST NEEDS TO BE APPROVED/CONFIRMED BY US BEFORE YOUR RESERVATION IS LOCKED IN, AND YOUR ACCOUNT IS CHARGED. THANKS

This booking is for play only. Any photo shoot or film production of any kind needs to be booked separately.'),
  ('swimply', 'swimply:75650', 'Feliks Dream', null, 'Los Angeles', null, null, 1, null, false, true, 'Private Rental', 'Los Angeles', true, 'https://swimply.com/p/75650', 'LA', 40.0, 10, 4.9, 68, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/1719675166895-IMG_1784.jpeg', 'Only few private courts available in Sheman Oaks.'),
  ('swimply', 'swimply:59915', 'Pickleball in Paradise (and TENNIS!)', null, 'Los Angeles', null, null, 1, null, false, true, 'Private Rental', 'Los Angeles', true, 'https://swimply.com/p/59915', 'LA', 29.0, 8, 5.0, 392, 'pickleball', 'https://swimply.imgix.net/thumbnails/59915-cover19218830811691818712.jpeg', 'Available for TENNIS TOO! We created 2 North/South regulation pickleball courts on our tennis court. There''s a charming, shaded gazebo beside our little orchard with dining table and chairs, a separate seating area and a court-viewing bar with stools.  You''ll have access to a private restroom in the guest house. The court is LIT for evening play.  Parking permits provided or driveway parking available for weekday street-parking during restricted hours of 9-6PM. Mon-Fri. Free street-parking after 6:PM . No permits needed for street parking on weekends. We are near the intersection of the 101 and the 405. Near the Galleria. Easy access from Westside.  An absolute oasis in the center of LA, but feels like a world away! **Please inquire about special pricing for film and photo shoots.'),
  ('swimply', 'swimply:59441', 'Tennis Oasis!', null, 'Los Angeles', null, null, 1, null, false, true, 'Private Rental', 'Los Angeles', true, 'https://swimply.com/p/59441', 'LA', 29.0, 5, 5.0, 8, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/59441-72005532871691202777.jpeg', 'DO NOT BOOK ON THIS PAGE! This court is OPEN for tennis and pickleball BUT you CANNOT book on this calendar!! You must book from my listing in the PICKLEBALL section and search my "Pickleball  in Paradise" page.  This will avoid double-booking as the calendars don''t synch. OR message me and I''ll help you out. 

Play hard, day or night, then rest in a shady, stylish, furnished gazebo in a super-private park-like setting by our little orchard. And with 8 banks of overhead stadium lights, you can keep playing after the sun goes down. You also have access to two regulation Pickleball courts  (painted lines and nets included) and a 3/4 basketball court. Private restroom in guest house. Driveway parking Mon-Fri 8am-6pm.  Street parking evenings and weekends. Please inquire about special pricing for film and photography shoots.'),
  ('swimply', 'swimply:51706', 'Spacious private tennis nestled in trees', null, 'Los Angeles', null, null, 1, null, false, true, 'Private Rental', 'Los Angeles', true, 'https://swimply.com/p/51706', 'LA', 46.0, 20, 5.0, 34, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/51706-cover8374670871683520542.jpeg', 'Spacious, private tennis court surrounded by trees which offers plenty of shade. Court comes with tennis ball launcher and tennis ball mower. Lights available for evening play. Shaded seating available for viewing. Plenty of private parking (up to 10 cars). Private restroom amenity available. Brand new net and tennis balls for sale.'),
  ('swimply', 'swimply:52805', 'Beautiful Tennis Court in Tarzana', null, 'Los Angeles', null, null, 1, null, false, true, 'Private Rental', 'Los Angeles', true, 'https://swimply.com/p/52805', 'LA', 35.0, 15, 5.0, 161, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/52805-cover2682333991693341305.jpeg', 'Check out our virtual tour https://swimplyl.ink/TT18JW08CP We have a beautiful private tennis court surrounded by large, green trees and a covered seating area. PERFECT for lessons, casual play and photo shoots.'),
  ('swimply', 'swimply:37378', 'Grand 1920''s Pool', null, 'Los Angeles', null, null, 1, null, false, true, 'Private Rental', 'Los Angeles', true, 'https://swimply.com/p/37378', 'LA', 52.0, 30, 5.0, 81, 'pool', 'https://swimply.imgix.net/thumbnails/37378-cover15654007911655761221.jpeg', 'Check out our virtual tour https://swimplyl.ink/TT18JW0FAG Think old world, rustic, and mediterranean. Long, beautiful, classic 1920''s pool surrounded by Cleveland sage, trees, poppies, and seasonal grass.
 
The pool is huge! Great for large groups and parties as well as lap swimmers. Multiple charming sitting areas so you never feel crowded. We also have a tree surrounded tennis court that you can find under “1920’s Tennis Court”.

The place is Magical at night. 

If you have a larger party idea (15-30 people or beyond) please message and we’ll make sure to set it up for success!

We’re a family of artists and musicians and the house doubles as an art school - Valley Art Workshop.'),
  ('swimply', 'swimply:48340', '1920''s Tennis Court Surrounded by Trees', null, 'Los Angeles', null, null, 1, null, false, true, 'Private Rental', 'Los Angeles', true, 'https://swimply.com/p/48340', 'LA', 35.0, 15, 5.0, 13, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/48340-cover6753422911671738739.jpeg', 'A beautiful old-school tennis court built in the 1920''s. Concrete surface. 
It has an old Hollywood vibe with lovely ornamental details, surrounded by trees. 
Seating hugs the west side of the court. 
Excellent dappled shade in the mornings and great evening shade for 1-2 hours before sunset. 
The place is excellent for small gatherings and casual tennis matches as well as tennis instruction and serious games. IF YOU ARE INTERESTED IN PHOTOSHOOTS or other forms of production, please reach out for a custom price. We invite production and are very reasonably priced but will need to discuss with you.

The court is owned by a family of artists that also runs the Valley Art Workshop out of the house.'),
  ('swimply', 'swimply:39477', 'Pro Tennis Court. Very Private!', null, 'Los Angeles', null, null, 1, null, false, true, 'Private Rental', 'Los Angeles', true, 'https://swimply.com/p/39477', 'LA', 32.0, 20, 5.0, 74, 'tennisCourt', 'https://swimply.imgix.net/thumbnails/1752364426093-Tennis Sunrise.jpg', '$20')
on conflict (source_id, external_id) do update set
  name = excluded.name,
  city = excluded.city,
  facility_booking_url = excluded.facility_booking_url,
  price_per_hour = excluded.price_per_hour,
  max_guests = excluded.max_guests,
  rating = excluded.rating,
  reviews_count = excluded.reviews_count,
  listing_type = excluded.listing_type,
  cover_image_url = excluded.cover_image_url,
  description = excluded.description;
