import copy
import unittest
from build_source_art import project, public_url, state


def fixture():
    q = dict(qid="exact-quest", mapId="map-a", setId="summary-set", category={"name":"Story"}, actIndex=4, chapterIndex=2, questIndex=1, difficultyId="",
             actImage="https://kabam-marvel.shared.mcoc-cdn.net/quests/act.jpg", bgImage="quests/autoscale_quest_tile_champ_bg_placeholder_61c900e93209.jpg", rewardImage="")
    chapter = dict(chapterId="native-chapter", friendlyName="Native chapter", image="https://kabam-marvel.shared.mcoc-cdn.net/quests/chapter.jpg", Quests=[q])
    act = dict(actId="native-act", friendlyName="Native act", image=q['actImage'], imageSmall="", imageLarge=None, Chapters=[chapter])
    doc = dict(format="cerebro.public-quest-art.v1", gameAssemblySha256="01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb",
               pveSets=[dict(setId="container-set", Acts=[act], QuestSummarys={q['qid']:q})])
    original = dict(id=q['qid'], mapId=q['mapId'], summarySetId=q['setId'], containerSetId="container-set", category="Story", actIndex=4, chapterIndex=2, questIndex=1, difficultyId="",sourceHash="frozen-map-hash",hierarchy=[dict(actId=act['actId'],chapterId=chapter['chapterId'])])
    return doc,[original]


class SourceArtProjectionTests(unittest.TestCase):
    def test_exact_joins_keep_original_source_hash_and_separate_default_reward_roles(self):
        doc, catalog = fixture()
        result = project(doc,catalog)
        q = result['quests']['exact-quest']
        self.assertEqual(q['catalogSourceHash'], 'frozen-map-hash')
        self.assertEqual(result['references'][q['bgImage']]['state'], 'default')
        self.assertEqual(result['references'][q['rewardImage']]['state'], 'empty')
        self.assertEqual(state(None),'missing')
        self.assertEqual(state(''),'empty')

    def test_identity_or_correlated_membership_drift_never_inherits_parent_art(self):
        doc,catalog = fixture()
        for field,value in [('mapId','wrong'),('containerSetId','wrong'),('hierarchy',[dict(actId='wrong',chapterId='native-chapter')])]:
            changed=copy.deepcopy(catalog);changed[0][field]=value
            result=project(doc,changed)
            self.assertNotIn('exact-quest',result['quests'])
            self.assertIn('source identity drift',result['excluded']['exact-quest'])
        doc['gameAssemblySha256'] = 'unsupported'
        with self.assertRaisesRegex(ValueError, 'Unsupported'):
            project(doc,catalog)

    def test_download_allowlist_accepts_only_exact_public_quest_asset_urls(self):
        self.assertTrue(public_url('https://kabam-marvel.shared.mcoc-cdn.net/quests/exact%20image.jpg'))
        for url in ['http://kabam-marvel.shared.mcoc-cdn.net/quests/a.jpg','https://example.com/quests/a.jpg','https://kabam-marvel.shared.mcoc-cdn.net/quests/a.jpg?token=x','https://kabam-marvel.shared.mcoc-cdn.net/quests/%2e%2e/private.jpg','https://kabam-marvel.shared.mcoc-cdn.net/api/quests.jpg','quests/a1']:
            self.assertFalse(public_url(url),url)


if __name__ == '__main__': unittest.main()
