-- Portable form of the user-authorized 31 Storm + 37 remaining length allowances.
-- See allowances.json for immutable source identities and authority hashes.
-- Numeric IDs are deliberately not used: they can differ between databases.
BEGIN;

CREATE FUNCTION champion_overview_text_limit(link_id integer, data_schema text)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path = pg_catalog AS $function$
DECLARE permitted boolean;
BEGIN
  EXECUTE format($query$
    SELECT EXISTS (
      SELECT 1 FROM %1$I."ChampionAbilityLink" l
      JOIN %1$I."Champion" c ON c.id = l."championId"
      JOIN %1$I."Ability" a ON a.id = l."abilityId"
      JOIN (VALUES
      ('america-chavez', 'Power Gain', 'ABILITY', 'UNKNOWN', 'GAIN', '8d816a6534ff24e6bbfe6d8359434bff3edf60fa1a46cadf736b9c5b55f57092', ARRAY['annihilus']::text[]),
      ('doctor-octopus', 'Power Lock', 'ABILITY', 'DEBUFF', 'INFLICT', '9d66e913bf58323457f93391db9719727da7e162913092c7ed58e69d279a57e7', ARRAY[]::text[]),
      ('doctor-octopus', 'Power Drain', 'ABILITY', 'UNKNOWN', 'INFLICT', '2241f6624e93a922d46d2202f88ee2cc9b546e9c85c10b18df9019be15a23ca1', ARRAY[]::text[]),
      ('doctor-octopus', 'Heal Block', 'ABILITY', 'DEBUFF', 'INFLICT', 'ea22cc8407048b4ad50a438a8bfe07f3c52f09f8013ecc22b2a817041bbd2929', ARRAY[]::text[]),
      ('doctor-octopus', 'Life Steal', 'ABILITY', 'UNKNOWN', 'GAIN', '86b7560515768bbe3675c8e941be14ccaa6ee60d2e1b974641adc2b56c97d232', ARRAY[]::text[]),
      ('doctor-octopus', 'Armor Up', 'ABILITY', 'BUFF', 'GAIN', 'c8acef079549dff770f093826ef3ded767ec53304d84736df8f8500d102b85ec', ARRAY[]::text[]),
      ('black-panther-civil-war', 'Reflective Matrix', 'ABILITY', 'UNKNOWN', 'GAIN', '500285b81eb34b80d7532462b27e62722f555a536edb8cad08b3f1cdb8dbf8b4', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Pre-Fight Ability', 'ABILITY', 'UNKNOWN', 'GAIN', '70af25af79a3eb765a32f0dc85623d1a6e3ceb25ebc5bbc16f7dc8f9b2e83ca0', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Glance', 'ABILITY', 'UNKNOWN', 'GAIN', '0f0f39e8194a0c6b570f87f23280f80af1be825620243ed18c4a94d5d1c1dea9', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', 'c80f0ec3a082075d35073e1b064a7ef5cee2904a63d65f5232f3671b82fb10de', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '6ab4ae34c257baae1f91f9b2c74cced54e0fce00d40664266e1539e8040c6868', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Coldsnap', 'ABILITY', 'PASSIVE', 'INFLICT', '758d3bf46b9297f359c0997319c8d473d5aa7d1b6ce4a1222b5b83a0db73a7b6', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Defensive Combat Power Rate Reduction', 'ABILITY', 'UNKNOWN', 'INFLICT', 'bdb56e939030254a43bce89a66e4d072b573ac5a36c91b014d3b1f9a5f781054', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Coldsnap', 'IMMUNITY', 'UNKNOWN', 'UNKNOWN', '7c13360d62ba9acbd0c71d80232474ba6c4a293f61be3bd792f07963c321197e', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Frostbite', 'IMMUNITY', 'UNKNOWN', 'UNKNOWN', '7c13360d62ba9acbd0c71d80232474ba6c4a293f61be3bd792f07963c321197e', ARRAY[]::text[]),
      ('america-chavez', 'Regeneration', 'ABILITY', 'UNKNOWN', 'GAIN', 'ac3997c6643febc563514605e8d2473b0de2c44a1506a939311285b4e8c0c8f0', ARRAY['ghost-rider', 'the-hood']::text[]),
      ('america-chavez', 'Atrophy', 'ABILITY', 'UNKNOWN', 'INFLICT', '766c8c3c7299a591b1151ef4b90a539720d2312c1cc37f8506f88c93091c00a6', ARRAY['kate-bishop']::text[]),
      ('america-chavez', 'Energy Resistance Reduction', 'ABILITY', 'UNKNOWN', 'INFLICT', '7ef389fdda1a42fb4a5c410c7a70926c2e1afa3fd539d6bea432122b88c4f799', ARRAY['spot']::text[]),
      ('america-chavez', 'Utopian Parallel', 'ABILITY', 'UNKNOWN', 'GAIN', 'fd13b45beb0ef9e8ff350e92ad6f9b48cd75246743322c2bde682d078d52e4a8', ARRAY[]::text[]),
      ('america-chavez', 'Dark Dimension', 'ABILITY', 'UNKNOWN', 'GAIN', '435929aac10faa8a839941f6827f9a0b416c2b2806dc2a0bc1a1a68e1c4117ab', ARRAY[]::text[]),
      ('america-chavez', 'Negative Zone', 'ABILITY', 'UNKNOWN', 'GAIN', '85a2cf06a90517cc4731ed65ab06631e77f9d00271d01566d159e9174c5d11bf', ARRAY[]::text[]),
      ('black-panther-civil-war', 'Reflect Charge', 'ABILITY', 'PASSIVE', 'GAIN', 'eb0ccc6dff1a3032d8e544fc037fabf292e30032a368a97f045bc0b113e8de40', ARRAY[]::text[]),
      ('black-panther-civil-war', 'Reflective Matrix', 'ABILITY', 'UNKNOWN', 'GAIN', 'f0a333290e01830fdf8c2d649bbf0a5ec99e2ac68064273adb5d142385aeadd1', ARRAY[]::text[]),
      ('black-panther-civil-war', 'Reflect Charge', 'ABILITY', 'PASSIVE', 'GAIN', '7acd5404609dc708cabbd01c02e1ef8e3d5f7b554fa7c4b2228c0c77a73a9362', ARRAY['gentle']::text[]),
      ('black-panther-civil-war', 'Reflect Charge', 'ABILITY', 'PASSIVE', 'GAIN', '7aa53ccd353aeff00aa1c0ffe879a5059b557fce843b47b17c0b42e2cb50e509', ARRAY['hulkbuster']::text[]),
      ('black-panther-civil-war', 'Reflect Charge', 'ABILITY', 'PASSIVE', 'GAIN', 'c520578e3a8fdbe643f65d8e16001365e2448415227925b4cbb8d8ce64c34842', ARRAY['hulkbuster']::text[]),
      ('doctor-octopus', 'Power Steal', 'ABILITY', 'UNKNOWN', 'INFLICT', '2241f6624e93a922d46d2202f88ee2cc9b546e9c85c10b18df9019be15a23ca1', ARRAY[]::text[]),
      ('doctor-octopus', 'Burst Damage', 'ABILITY', 'UNKNOWN', 'INFLICT', '86b7560515768bbe3675c8e941be14ccaa6ee60d2e1b974641adc2b56c97d232', ARRAY[]::text[]),
      ('doctor-octopus', 'Heal Block', 'ABILITY', 'DEBUFF', 'INFLICT', 'f3ab0e37de883f4e096e7ae3c4486714b96a96aaa1c2f4e4d02c4c96e2c612f6', ARRAY['diablo']::text[]),
      ('doctor-octopus', 'Heal Block', 'ABILITY', 'DEBUFF', 'INFLICT', '144d94d7d99d60d5004aec97ee481d653562f97d6f92346032e35706c4e7b9ed', ARRAY['ant-man']::text[]),
      ('doctor-octopus', 'Life Steal', 'ABILITY', 'UNKNOWN', 'GAIN', 'b639b44cc63d2a3ccdbb2b7779c2993a9123fd9a91eec03382aa940903066e29', ARRAY['ant-man']::text[]),
      ('doctor-octopus', 'Heal Block', 'ABILITY', 'DEBUFF', 'INFLICT', '6f97d27d084660ed77ca5c01aa89da95f98cc168d33e004ae47c2707b7aba4b5', ARRAY['ant-man']::text[]),
      ('doctor-octopus', 'Life Steal', 'ABILITY', 'UNKNOWN', 'GAIN', '252ae4698ead50a86123a79ccd868b717e7617ce4e90a4ec6fc918a787cab830', ARRAY['ant-man']::text[]),
      ('doctor-octopus', 'Heal Block', 'ABILITY', 'DEBUFF', 'INFLICT', '6ee8d20e71da59e55f29f9d440861405c37e19c32d6eb2de2c36d971cee0ae1e', ARRAY['ant-man']::text[]),
      ('doctor-octopus', 'Life Steal', 'ABILITY', 'UNKNOWN', 'GAIN', '65eae52707741c348cdd9d6b41c4137de2854c90877807f0fb3af7ff704801ce', ARRAY['ant-man']::text[]),
      ('doctor-octopus', 'Heal Block', 'ABILITY', 'DEBUFF', 'INFLICT', '413edf195580272d47de32285f0b30663f306c3f2efdd6c627fd2e1a7088d2be', ARRAY['ant-man']::text[]),
      ('doctor-octopus', 'Life Steal', 'ABILITY', 'UNKNOWN', 'GAIN', '05630f07383d67cd3e868e04fad14996b609948705c1880600aec697a31a4344', ARRAY['ant-man']::text[]),
      ('doctor-octopus', 'Gain Power', 'ABILITY', 'UNKNOWN', 'GAIN', '1541ae68f27a0c664f4264087109159a109f67641b77c34a95a5f0238fceac8f', ARRAY[]::text[]),
      ('quicksilver', 'Whiplash', 'ABILITY', 'DEBUFF', 'INFLICT', '459788eda4e5873d94ec029cda02cdddddeea987d858b34412212dfb5f6be23e', ARRAY['ghost-rider-robbie-reyes']::text[]),
      ('scream', 'Madness', 'ABILITY', 'PASSIVE', 'GAIN', 'dece8b17e877d5069902e46036b99289f6b76207e586533ccc70591989545efb', ARRAY[]::text[]),
      ('scream', 'Madness', 'ABILITY', 'PASSIVE', 'GAIN', '6ac34e5c15f7f409f2705e7b8c5c17f99900b53afe710a52b75a6e8464bbdcd4', ARRAY[]::text[]),
      ('spider-punk', 'Rupture', 'ABILITY', 'DEBUFF', 'INFLICT', '5bb0e3755e3e34c629c3385f89bc983a3dd09b8bc36e65b5f94b1e061ee5d3e1', ARRAY['green-goblin', 'iron-patriot', 'red-goblin']::text[]),
      ('spider-punk', 'Crowd Members', 'ABILITY', 'UNKNOWN', 'GAIN', '78897934ac069cc000de37131190606c866fdd9925d8ba10d2810e66567824bb', ARRAY[]::text[]),
      ('spider-punk', 'Crowd Members', 'ABILITY', 'UNKNOWN', 'GAIN', '913baa1267b67dcf538c49afc16481462fdb4770c58a7f078392c87699c734c7', ARRAY['shathra']::text[]),
      ('storm-pyramid-x', 'Stun', 'ABILITY', 'DEBUFF', 'INFLICT', '3c5f4b677a8384bb22cfc5a3663b3ff0ed40e8903bc8d117c130b2e852e83c1f', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Stun', 'ABILITY', 'PASSIVE', 'INFLICT', '6d861347a9c4bfbc247c3071590e127c00f2ed533835765b0b356bad3a3734cd', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Shock Resistance', 'ABILITY', 'UNKNOWN', 'GAIN', 'f6125fc93f12e643aa8ce013e0cab04db69bbb99220e6331e08b54cb763d7ccb', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Ice Tempest', 'ABILITY', 'UNKNOWN', 'GAIN', '83f6dc0cc16813f7d702d56fd1c66e8c970eb9452b4dfe56f0efaeb06666977c', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Lightning Tempest', 'ABILITY', 'UNKNOWN', 'GAIN', 'a259ddb3e671018637ef130f09040c162b352a8cfb8a510db703657fac9273f7', ARRAY[]::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '2fad97680173a0dedae94f5eefbee53e79545259bbcda1d92245a76b72fc9ce2', ARRAY['howard-the-duck']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', 'f0b9812b9213410b3e1c149b2c73a4d4b678b731f144950b47428aa666232a28', ARRAY['bishop']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', 'd308f4d4da6b0694d1c0b0a7575d64cb63501db5553c7c468ba1eaf70c22e7ec', ARRAY['apocalypse']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '8529c9830e71ecdda38297183be0a18196f9f7eef46191e20dbd3919191697b1', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '73594425f18f6bb6b259266990b059bd8c0495b3d1a1bfeced366647bc7617be', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', 'a3a53dba843f63d86fda36d4d746bb451a6904e449b3f9031114920771f53da0', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '7c4dd04e9ddf3afecc434483bf5d3dfd9683328a2b903f67b0694f0d56f17899', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '0bb5485c4cbe983bfe6c522cb52b4bc95f52f0d1009706133276c9c4e503ed2b', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '88cfb376c3743777975550984b15d9ea7be6657e475b726a918b5c735ebbb648', ARRAY['howard-the-duck']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', 'deb97cc04fb622f5b657b46123e60d53bdd27537d69b3555be67053209d78e77', ARRAY['bishop']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '154d149eab8a3498bdfb2db36f8ea4d95c0accaab1cd6acc93153c9b5cad9be9', ARRAY['apocalypse']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '4110c3665042b426374b8aae1e4dda8c51e52281f70716859290cf73cea2b700', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '685e97a10a65de891239f0a7fadafa8161e0660b820c1ceaf085a9eb5c448c1d', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', 'cd85346dc39262a59f4f2ecb47875d7b9a822c4e75e091116213b0770983b94c', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '802e7e6d47fd525ed75116f28848a46fa5bf80065dacfd726187cf2a8e8a66c0', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Prowess', 'ABILITY', 'BUFF', 'GAIN', '12b394e67a9c61c0ecf5e969d7ba041778bd3c44fb5a9c022a96235e583c41d5', ARRAY['professor-x']::text[]),
      ('storm-pyramid-x', 'Ice Tempest', 'ABILITY', 'UNKNOWN', 'GAIN', '66bdefbdf5e01a2b7ce0ebb80006cc09b275fea32742a1a777ade0c093b6c002', ARRAY['storm']::text[]),
      ('storm-pyramid-x', 'Lightning Tempest', 'ABILITY', 'UNKNOWN', 'GAIN', '5d3f04a31c7ca7c770d1dc9c52af45ae3f8ff64a994e17ddb556400c6a66393c', ARRAY['storm']::text[]),
      ('tigra', 'Rupture', 'ABILITY', 'UNKNOWN', 'INFLICT', '182175b06a0e0d54e963af3e7f89220deeb79486dcdff73c20886caeed954a32', ARRAY['elsa-bloodstone']::text[])
      ) allowed(slug, ability, link_type, effect_form, direction, source_hash, partners)
        ON c.slug = allowed.slug AND a.name = allowed.ability
       AND l.type::text = allowed.link_type AND l."effectForm"::text = allowed.effect_form
       AND l."effectDirection"::text = allowed.direction
       AND encode(sha256(convert_to(l.source, 'UTF8')), 'hex') = allowed.source_hash
      WHERE l.id = $1 AND allowed.partners = ARRAY(
        SELECT partner.slug FROM %1$I."ChampionAbilitySynergy" s
        LEFT JOIN %1$I."Champion" partner ON partner.id = s."championId"
        WHERE s."championAbilityLinkId" = l.id ORDER BY partner.slug COLLATE "C"
      )
    )
  $query$, data_schema) INTO permitted USING link_id;
  RETURN CASE WHEN permitted THEN 1000 ELSE 360 END;
END;
$function$;

CREATE FUNCTION enforce_champion_overview_text_length()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $function$
DECLARE maximum integer;
BEGIN
  IF char_length(NEW.text) <= 360 THEN RETURN NEW; END IF;
  EXECUTE format('SELECT %I.champion_overview_text_limit($1, $2)', TG_TABLE_SCHEMA)
    INTO maximum USING NEW."championAbilityLinkId", TG_TABLE_SCHEMA;
  IF char_length(NEW.text) > maximum THEN
    RAISE EXCEPTION 'Champion ability overview exceeds its authorized % character limit', maximum
      USING ERRCODE = '23514', CONSTRAINT = 'ChampionAbilityOverview_text_length';
  END IF;
  RETURN NEW;
END;
$function$;

-- Check preexisting data before replacing the old local/global constraint.
DO $validation$
BEGIN
  IF EXISTS (SELECT 1 FROM "ChampionAbilityOverview"
    WHERE char_length(text) > champion_overview_text_limit("championAbilityLinkId", current_schema())) THEN
    RAISE EXCEPTION 'Existing long overview lacks an exact authorized source identity';
  END IF;
END;
$validation$;

ALTER TABLE "ChampionAbilityOverview" DROP CONSTRAINT "ChampionAbilityOverview_text_length";
ALTER TABLE "ChampionAbilityOverview" ADD CONSTRAINT "ChampionAbilityOverview_text_length"
  CHECK (char_length(text) BETWEEN 1 AND 1000);
CREATE TRIGGER "ChampionAbilityOverview_scoped_text_length"
  BEFORE INSERT OR UPDATE ON "ChampionAbilityOverview"
  FOR EACH ROW EXECUTE FUNCTION enforce_champion_overview_text_length();

-- Keep the cross-table authorization in a trigger, not a CHECK: pg_dump restores
-- data before triggers, so partner/source table restore order cannot break it.
COMMIT;
