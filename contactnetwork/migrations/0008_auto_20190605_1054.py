# Generated by Django 2.0.8 on 2019-06-05 08:54

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('structure', '0017_structure_contact_representative_score'),
        ('residue', '0002_auto_20180504_1417'),
        ('protein', '0007_proteingproteinpair_references'),
        ('contactnetwork', '0007_auto_20190227_1003'),
    ]

    operations = [
        migrations.CreateModel(
            name='consensus_interactions',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('frequency', models.DecimalField(decimal_places=2, max_digits=5)),
                ('gn1', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='GN_1', to='residue.ResidueGenericNumber')),
                ('gn2', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='GN_2', to='residue.ResidueGenericNumber')),
                ('protein_class', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='protein.ProteinFamily')),
                ('proteins', models.ManyToManyField(to='protein.Protein')),
                ('state', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='protein.ProteinState')),
                ('structures', models.ManyToManyField(to='structure.Structure')),
            ],
        ),
        migrations.AlterUniqueTogether(
            name='consensus_interactions',
            unique_together={('gn1', 'gn2', 'protein_class', 'state')},
        ),
    ]
