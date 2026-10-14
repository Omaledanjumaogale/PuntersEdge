"""Synthetic fixtures here are unit-test inputs, never accuracy evidence."""
import os
import tempfile
import json
import unittest
from datetime import datetime,timedelta,timezone
from train import load_csv,fit,predict,walk_forward,export_artifact,main


class Training(unittest.TestCase):
    def test_cli_serializes_artifact_and_empty_evaluation(self):
        with tempfile.TemporaryDirectory() as folder:
            source=os.path.join(folder,'unit-test.csv')
            output=os.path.join(folder,'artifact.json')
            report=os.path.join(folder,'evaluation.json')
            with open(source,'w',encoding='utf-8') as f:
                f.write('fixture_id,league,home,away,kickoff,available_at,home_goals,away_goals\n')
                f.write('1,L,A,B,2025-01-01T12:00:00Z,2025-01-01T15:00:00Z,1,0\n')
                f.write('2,L,B,A,2025-01-02T12:00:00Z,2025-01-02T15:00:00Z,0,1\n')
            main(['train','--csv',source,'--league','L','--cutoff','2025-01-03T00:00:00Z',
                  '--version','unit-test-only','--output',output])
            with open(output,encoding='utf-8') as f: artifact=json.load(f)
            self.assertEqual(artifact['trainingCount'],2)
            self.assertEqual(artifact['teams'].keys(),{'A','B'})
            main(['evaluate','--csv',source,'--league','L','--holdout-start','2025-01-01T00:00:00Z',
                  '--output',report])
            with open(report,encoding='utf-8') as f: evaluation=json.load(f)
            self.assertEqual(evaluation['count'],0)
            self.assertIsNone(evaluation['brier'])
            self.assertEqual(len(evaluation['skipped']),2)

    def test_csv_rejects_leakage_and_naive_time(self):
        header='fixture_id,league,home,away,kickoff,available_at,home_goals,away_goals,odds_snapshot_at\n'
        cases=[
            '1,L,A,B,2026-01-01T12:00:00,2026-01-01T15:00:00Z,1,0,',
            '1,L,A,B,2026-01-01T12:00:00Z,2026-01-01T11:00:00Z,1,0,',
            '1,L,A,B,2026-01-01T12:00:00Z,2026-01-01T15:00:00Z,1,0,2026-01-01T13:00:00Z']
        for line in cases:
            with tempfile.NamedTemporaryFile(mode='w',delete=False,suffix='.csv') as f:
                f.write(header+line+'\n'); path=f.name
            try:
                with self.assertRaises(ValueError): load_csv(path)
            finally: os.unlink(path)

    def test_identifiability_and_chronological_results(self):
        start=datetime(2025,1,1,tzinfo=timezone.utc)
        rows=[]
        for i in range(12):
            kick=start+timedelta(days=i)
            rows.append(dict(fixture_id=str(i),league='unit-test-only',
                             home='A' if i%2==0 else 'B',away='B' if i%2==0 else 'A',
                             kickoff=kick,available_at=kick+timedelta(hours=3),
                             home_goals=i%3,away_goals=(i+1)%3))
        cutoff=start+timedelta(days=10)
        with self.assertRaises(ValueError): fit(rows,cutoff)
        model=fit(rows[:10],cutoff)
        self.assertAlmostEqual(sum(model['attack'].values()),0)
        self.assertAlmostEqual(sum(model['defense'].values()),0)
        artifact=export_artifact(model,'unit-test-only')
        self.assertEqual(artifact['version'],'unit-test-only')
        self.assertEqual(set(artifact['teams']['A']),{'attack','defence'})
        self.assertFalse(artifact['validated'])
        self.assertAlmostEqual(sum(predict(model,'A','B')['grid'].values()),1)
        with self.assertRaises(ValueError): predict(model,'A','unknown')
        result=walk_forward(rows,cutoff,min_training=5)
        self.assertEqual(result['count'],2)
        self.assertEqual([r['training_count'] for r in result['predictions']],[10,11])
        self.assertEqual(result['predictions'][0]['prediction_at'],
                         (cutoff-timedelta(hours=1)).isoformat())
        self.assertTrue(0 <= result['brier'] <= 2)
        # Delayed results must not become eligible before availability.
        rows[0]['available_at']=start+timedelta(days=30)
        delayed=walk_forward(rows,cutoff,min_training=5)
        self.assertEqual([r['training_count'] for r in delayed['predictions']],[9,10])
        rows[1]['available_at']=cutoff-timedelta(minutes=30)
        horizon=walk_forward(rows,cutoff,min_training=5)
        self.assertEqual(horizon['predictions'][0]['training_count'],8)
        rows[10]['odds_snapshot_at']=cutoff-timedelta(minutes=30)
        with self.assertRaises(ValueError): walk_forward(rows,cutoff,min_training=5)


if __name__=='__main__': unittest.main()
