# Generated by Django 3.0.8 on 2020-11-30 13:37

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('protein', '0009_auto_20200511_1818'),
        ('ligand', '0019_auto_20201130_1406'),
    ]

    operations = [
        migrations.AlterField(
            model_name='ligandreceptorstatistics',
            name='protein',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='target_protein', to='protein.Protein'),
        ),
    ]