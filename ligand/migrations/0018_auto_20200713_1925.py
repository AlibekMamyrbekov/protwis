# Generated by Django 3.0.2 on 2020-07-13 17:25

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ligand', '0017_remove_chemblassays_skip'),
    ]

    operations = [
        migrations.AlterField(
            model_name='assayexperiment',
            name='pchembl_value',
            field=models.DecimalField(decimal_places=3, max_digits=9, null=True),
        ),
        migrations.AlterField(
            model_name='chemblassays',
            name='pchembl_value',
            field=models.DecimalField(decimal_places=3, max_digits=9, null=True),
        ),
    ]
