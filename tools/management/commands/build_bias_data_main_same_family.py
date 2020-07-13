from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.db import connection
from django.db import IntegrityError
from django.utils.text import slugify
from django.http import HttpResponse, JsonResponse

from build.management.commands.base_build import Command as BaseBuild
from common.tools import fetch_from_cache, save_to_cache, fetch_from_web_api
from residue.models import Residue
from protein.models import Protein, ProteinGProteinPair
from ligand.models import Ligand, LigandProperities, LigandRole, LigandType, BiasedExperiment, ExperimentAssay, AnalyzedExperiment, AnalyzedAssay

from ligand.functions import get_or_make_ligand
from common.models import WebLink, WebResource, Publication
from decimal import Decimal
import logging
import os
from datetime import datetime
import xlrd
import operator
import traceback
import time
import math
import json


MISSING_PROTEINS = {}
SKIPPED = 0


class Command(BaseBuild):
    mylog = logging.getLogger(__name__)
    mylog.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s:%(levelname)s:%(message)s')
    file_handler = logging.FileHandler('biasDataTest.log')
    file_handler.setLevel(logging.ERROR)
    file_handler.setFormatter(formatter)
    mylog.addHandler(file_handler)

    help = 'Reads bias data and imports it'
    # source file directory
    # structure_data_dir = os.sep.join([settings.EXCEL_DATA, 'ligand_data', 'bias'])
    structure_data_dir = 'excel/'
    publication_cache = {}
    ligand_cache = {}
    data_all = []

    def add_arguments(self, parser):
        parser.add_argument('-p', '--proc',
                            type=int,
                            action='store',
                            dest='proc',
                            default=1,
                            help='Number of processes to run')
        parser.add_argument('-f', '--filename',
                            action='append',
                            dest='filename',
                            help='Filename to import. Can be used multiple times')
        parser.add_argument('-u', '--purge',
                            action='store_true',
                            dest='purge',
                            default=False,
                            help='Purge existing bias records')
        parser.add_argument('--test_run', action='store_true', help='Skip this during a test run',
                            default=False)

    def handle(self, *args, **options):
        if options['test_run']:
            print('Skipping in test run')
            return
        # delete any existing structure data
        if options['purge']:
            try:
                self.purge_bias_data()
            except Exception as msg:
                print(msg)
                self.logger.error(msg)
        # import the structure data
        self.bias_list()
        try:
            print('CREATING BIAS DATA')
            print(options['filename'])
            # self.bias_list()
            self.logger.info('COMPLETED CREATING BIAS')

        except Exception as msg:
            print('--error--', msg, '\n')
            self.logger.info("The error appeared in def handle")



    def fetch_experiment(self, publication, ligand, receptor, source):
        """
        fetch receptor with Protein model
        requires: protein id, source
        """
        try:
            experiment = AnalyzedExperiment.objects.filter(
                publication=publication, ligand=ligand, receptor=receptor, source=source)
            experiment = experiment.get()
            return True
        except Exception as msg:
            experiment = None
            self.mylog.exception(
                "Protein AnalyzedExperiment error | module: AnalyzedExperiment.")
            return False


    def process_data(self, content):
        '''
        Merge BiasedExperiment with its children
        and pass it back to loop through dublicates
        '''
        rd = []
        counter = 0
        for instance in enumerate(content):
            temp_obj = []
            fin_obj = {}
            fin_obj['main'] = (instance[1])

            vendor_counter = 0
            for i in instance[1].experiment_data_vendors.all():
                vendor_counter=vendor_counter + 1

            for entry in instance[1].experiment_data.all():
                author_list = list()
                for author in entry.experiment_data_authors.all():
                    author_list.append(author.author)

                temp_obj.append(entry)
                counter += 1
            fin_obj['authors'] = author_list
            fin_obj['children'] = temp_obj
            fin_obj['vendor_counter'] = vendor_counter
            rd.append(fin_obj)

        print('---counter of assays at process data---', counter)
        return rd

    def change(self, rd):
        '''
        Merge bias experminet data with assay data
        Define family in accordance with subfamily
        '''
        test = list()
        send = dict()
        increment = 0
        counter = 0

        for j in rd:
            temp_dict = dict()
            temp = dict()
            doubles = []
            temp['publication'] = j['main'].publication
            if j['main'].receptor:
                temp['species'] = j['main'].receptor.species.common_name
            else:
                temp['species'] = None
            temp['endogenous_ligand'] = j['main'].endogenous_ligand
            temp['ligand'] = j['main'].ligand
            temp['chembl'] = j['main'].chembl
            temp['receptor'] = j['main'].receptor
            temp['assay'] = dict()
            temp['vendor_counter'] = j['vendor_counter']
            temp['reference'] = list()
            temp['authors'] = j['authors']
            temp['ref_ligand_experiment'] = dict()
            temp['article_quantity'] = 0
            temp['labs_quantity'] = 0
            temp['reference_ligand'] = None

            if not j['children']:
                continue
            else:

                temp_dict['signalling_protein'] = j['children'][0].signalling_protein
                temp_dict['cell_line'] = j['children'][0].cell_line
                temp_dict['family'] = j['children'][0].family
                temp_dict['assay_type'] = j['children'][0].assay_type
                temp_dict['assay_measure_method'] = j['children'][0].assay_measure
                temp_dict['assay_time_resolved'] = j['children'][0].assay_time_resolved
                temp_dict['quantitive_activity'] = j['children'][0].quantitive_activity
                temp_dict['quantitive_activity_initial'] = j['children'][0].quantitive_activity
                temp_dict['qualitative_activity'] = j['children'][0].qualitative_activity
                temp_dict['quantitive_unit'] = j['children'][0].quantitive_unit
                temp_dict['quantitive_efficacy'] = j['children'][0].quantitive_efficacy
                temp_dict['efficacy_unit'] = j['children'][0].efficacy_unit
                temp_dict['quantitive_measure_type'] = j['children'][0].quantitive_measure_type
                temp_dict['efficacy_measure_type'] = j['children'][0].efficacy_measure_type
                temp_dict['t_coefficient'] = j['children'][0].bias_value
                temp_dict['t_coefficient_initial'] = j['children'][0].bias_value_initial
                temp_dict['potency'] = ''
                temp_dict['t_factor'] = ''
                temp_dict['log_bias_factor'] = ''
                temp_dict['bias_reference'] = j['children'][0].bias_reference
                temp_dict['emax_reference_ligand'] = j['children'][0].emax_ligand_reference
                temp_dict['ligand_function'] = j['children'][0].ligand_function
                temp_dict['ligand'] = j['main'].ligand
                temp_dict['order_no'] = 0
                temp_dict['reference_ligand'] = None
                temp['ref_ligand_experiment'] = j['children'][0].emax_ligand_reference
                doubles.append(temp_dict)
                temp['assay'] = doubles
                send[increment] = temp
                increment = increment + 1
                counter += 1
        print('---counter of assays at change---', counter)
        return send


    def process_refs(self, context):
        '''
        Recieve data from "process_data"
        search for objects with same publication ligand receptor
        Create new object of biased_experiment and all children
        '''
        send = dict()
        increment = 0

        for j in context.items():

            ref = list()
            for data in j[1]:
                if data['assay'][0]['bias_reference'].lower() != "" and data['assay'][0]['bias_reference'] =='Reference':
                    if data in ref:
                        print('already in list')
                    else:
                        ref.append(data)

            for data in j[1]:
                for i in ref:

                    if (data['receptor'] == i['receptor'] and
                        data['species'] == i['species'] and
                        data['assay'][0]['assay_type'] == i['assay'][0]['assay_type'] and
                        data['assay'][0]['signalling_protein'] == i['assay'][0]['signalling_protein'] and
                        data['assay'][0]['cell_line'] == i['assay'][0]['cell_line'] and
                        data['assay'][0]['assay_measure_method'] == i['assay'][0]['assay_measure_method'] and
                        data['assay'][0]['bias_reference'] == 'Tested'):
                        data['assay'][0]['reference_quantitive_activity'] = i['assay'][0]['quantitive_activity']
                        data['assay'][0]['reference_quantitive_efficacy'] = i['assay'][0]['quantitive_efficacy']
                        data['assay'][0]['reference_t_coefficient_initial'] = i['assay'][0]['t_coefficient_initial']
                        data['assay'][0]['reference_ligand'] = i['assay'][0]['ligand']
                        data['reference_ligand'] = i['assay'][0]['ligand']
                        data['assay'][0]['reference_measure_type'] = i['assay'][0]['quantitive_measure_type']


            for data in j[1]:
                if data['assay'][0]['bias_reference'] =='Tested':
                    send[increment] = data
                    increment += 1

        print('---counter at process_refs---', increment,'\n')
        results_temp = self.process_group(send)

        return results_temp

    def process_calculation(self, context):
        countq = 0
        counter = 0
        counter1 = 0
        for i in context.items():
            test = dict()
            lgb_refine = dict()
            temp_obj = list()

            for j in i[1]['assay']:
                if j not in temp_obj:
                    temp_obj.append(j)
                else:
                    print('passing dublicate___-')
            i[1]['assay'] = temp_obj
            test = sorted(i[1]['assay'], key=lambda k: k['quantitive_activity']
                          if k['quantitive_activity'] else 999999,  reverse=False)

            for x in enumerate(test):
                x[1]['order_no'] = x[0]

            i[1]['biasdata'] = test
            i[1].pop('assay')

            self.calc_bias_factor(i[1]['biasdata'])
            #self.calc_t_coefficient(i[1]['biasdata'])

            most_potent = dict()
            for x in i[1]['biasdata']:
                if x['log_bias_factor'] and x['log_bias_factor'] < 0:
                    for j in i[1]['biasdata']:
                        if j['order_no'] == 0:
                            j['order_no'] = x['order_no']
                            x['order_no'] = 0
                    self.calc_bias_factor(i[1]['biasdata'])


            self.calc_potency(i[1]['biasdata'])

    # TODO: done
    def caclulate_bias_factor_variables(self,a,b,c,d):
        lgb = (a-b)-(c-d)
        return lgb

    def calc_bias_factor(self, biasdata):
        most_reference = dict()
        most_potent = dict()

        for i in biasdata:
            if i['order_no'] == 0:
                most_potent = i
                i['log_bias_factor'] = None

        for i in biasdata:
            temp_reference = dict()
            try:
                if i['order_no'] != 0:
                    if (i['quantitive_measure_type'].lower() == 'ec50' and i['reference_measure_type'].lower() == 'ec50' and
                        most_potent['quantitive_measure_type'].lower() == 'ec50' and most_potent['reference_measure_type'].lower() == 'ec50'):
                        a=0
                        b=0
                        c=0
                        d=0
                        a = math.log10(most_potent['quantitive_efficacy'] / most_potent['quantitive_activity'])
                        b = math.log10(most_potent['reference_quantitive_efficacy'] / most_potent['reference_quantitive_activity'])
                        c = math.log10(i['quantitive_efficacy'] / i['quantitive_activity'])
                        d = math.log10(i['reference_quantitive_efficacy'] / i['reference_quantitive_activity'])
                        temp_calculation = self.caclulate_bias_factor_variables(a,b,c,d)
                        # if temp_calculation < 0:
                        #     temp_calculation = self.caclulate_bias_factor_variables(c,d,a,b)
                        #     x = most_potent['order_no']
                        #     most_potent['order_no'] = i['order_no']
                        #     i['order_no'] = x

                        i['log_bias_factor'] = round(
                            temp_calculation, 1)
                    elif (i['quantitive_measure_type'].lower() == 'ic50' and temp_reference['quantitive_measure_type'].lower() == 'ic50' ):
                        i['log_bias_factor'] = 'Only agonist in main pathway'
                else:
                    i['log_bias_factor'] = None
            except:
                i['log_bias_factor'] = None


    def calc_t_coefficient(self, biasdata):
        for i in biasdata:
            if i['t_coefficient_initial'] != None and i['t_coefficient'] == None:
                i['t_coefficient'] = round(i['t_coefficient_initial'] - i['reference_t_coefficient_initial'],1)
                        #print('\nex data-----',i,'--referecne',j)

    def calc_potency(self, biasdata):
        count = 0
        most_potent = dict()
        for i in biasdata:
            count+=1
            if i['order_no'] == 0:
                most_potent = i
        #T_factor -- bias factor
        for i in biasdata:
            if i['order_no'] > 0:
                if i['quantitive_measure_type'].lower() == 'ec50' or i['quantitive_measure_type'].lower() == 'ic50' :
                    if i['quantitive_activity'] is not None and i['quantitive_activity'] != 0 and most_potent['quantitive_activity'] is not None:
                        i['potency'] = round(
                            i['quantitive_activity']/most_potent['quantitive_activity'], 1)
                    elif i['quantitive_measure_type'].lower() == 'pec50' or i['quantitive_measure_type'].lower() == 'pic50':
                        # TODO: round
                        i['potency'] = round(most_potent['quantitive_activity'] - i['quantitive_activity'] ,1)
                    else:
                        i['potency'] = None

                if i['t_coefficient'] is not None and most_potent['t_coefficient'] is not None:
                    # TODO: validate if difference is non negative
                    i['t_factor'] = round(most_potent['t_coefficient'] - i['t_coefficient'], 1)
                else:
                    i['t_factor'] = None

        # print('---counter of calc_potency---', count)

    def process_references(self, dictionary):
        context = dict()
        send = dict()
        counter = 0

        for j in dictionary.items():
            name = str(j[1]['publication'])
            temp_obj = list()

            if name in context:
                counter += 1
                temp_obj = context[name]

            temp_obj.append(j[1])
            context[name] = temp_obj
            context[name][0]['publication'] == name
        print('---context[name]s---', len(context), '\n')
        print('---counter of data at process_references---', counter)
        send = self.process_refs(context)

        return send

    def process_group(self, send):
        '''
        Recieve data from "process_data"
        search for objects with same publication ligand receptor
        Create new object of biased_experiment and all children
        '''
        doubles = list()
        result = list()
        context = dict()
        increment = 0
        for j in send.items():

            name = str(j[1]['publication']) + \
                '/' + str(j[1]['ligand']) + '/' + str(j[1]['receptor'])
            temp_obj = list()

            if(name in context):
                temp_obj = context[name]['assay']
                reference_obj = context[name]['reference']

            for i in j[1]['assay']:
                if i not in temp_obj:
                    temp_obj.append(i)

            context[name] = j[1]
            context[name]['assay'] = temp_obj
            increment=increment+1
        print('---counter of process_group---',increment,'\n' )

        self.process_calculation(context)

        self.count_publications(context)

        return context


    def count_publications(self, context):
        temp = dict()
        for i in context.items():
            labs = list()
            i[1]['labs'] = 0
            labs.append(i[1]['publication'])
            lab_counter = 0
            for j in context.items():
                if j[1]['publication'] not in labs:
                    if set(i[1]['authors']) & set(j[1]['authors']):
                        lab_counter += 1
                        labs.append(j[1]['publication'])
                        i[1]['labs'] = lab_counter


            temp_obj = 0
            name = str(i[1]['ref_ligand_experiment']) + \
                '/' + str(i[1]['ligand']) + '/' + str(i[1]['receptor'])
            if(name in temp):
                for assays in i[1]['biasdata']:
                    if assays['order_no'] > 0:
                        if assays['log_bias_factor'] != None and assays['log_bias_factor'] != '' or assays['t_factor'] != None and assays['t_factor'] != '':
                            temp_obj = temp[name] + 1

            temp[name] =  temp_obj

        for i in context.items():
            temp_obj = 0
            name = str(i[1]['ref_ligand_experiment']) + \
                '/' + str(i[1]['ligand']) + '/' + str(i[1]['receptor'])
            counter = 0
            if(name in temp):
                i[1]['article_quantity'] = temp[name]


    def fetch_receptor_trunsducers(self, receptor):
        primary = ""
        secondary = ""
        gprotein = ProteinGProteinPair.objects.filter(protein=receptor)
        for x in gprotein:
            if x.transduction and x.transduction == 'primary':
                primary += str(x.g_protein.name)
            elif x.transduction and x.transduction == 'secondary':
                secondary += str(x.g_protein.name)
        return primary, secondary


    def bias_list(self):
        print('i am in')
        context = {}
        content = BiasedExperiment.objects.all().prefetch_related(
            'experiment_data', 'experiment_data__experiment_data_authors', 'experiment_data_vendors', 'ligand', 'receptor', 'publication', 'publication__web_link', 'experiment_data__emax_ligand_reference',
            ).order_by('publication', 'receptor', 'ligand')

        # merge children
        pre_data = self.process_data(content)
        # transform to combined dictionary
        combined = self.change(pre_data)
        # combine references

        context.update({'data': self.process_references(combined)})

        for i in context['data'].items():
            # try:
                # i[1].pop('reference')
                # i[1].pop('biasdata')
                # TODO: move by one tab when uncomment try catch
            primary, secondary = self.fetch_receptor_trunsducers(i[1]['receptor'])
            source = 'same_family'

            if self.fetch_experiment(i[1]['publication'], i[1]['ligand'], i[1]['receptor'], source) == False:

                experiment_entry = AnalyzedExperiment(publication=i[1]['publication'],
                                                      ligand=i[1]['ligand'],
                                                      receptor=i[1]['receptor'],
                                                      chembl= i[1]['chembl'],
                                                      source = source,
                                                      endogenous_ligand = i[1]['endogenous_ligand'],
                                                      vendor_quantity = i[1]['vendor_counter'],
                                                      reference_ligand = i[1]['reference_ligand'],
                                                      primary = primary,
                                                      secondary = secondary,
                                                      article_quantity = i[1]['article_quantity'],
                                                      labs_quantity = i[1]['labs'],
                                                      )
                experiment_entry.save()


                for ex in i[1]['biasdata']:
                    if ex['quantitive_activity'] is not None:
                        ex['quantitive_activity'] = '%.2E' % Decimal(ex['quantitive_activity'])
                    # print('--saving---', '\n')
                    emax_ligand = ex['emax_reference_ligand']
                    experiment_assay = AnalyzedAssay(experiment=experiment_entry,
                                                     family=ex['family'],
                                                     order_no=ex['order_no'],
                                                     signalling_protein=ex['signalling_protein'],
                                                     cell_line=ex['cell_line'],
                                                     assay_type=ex['assay_type'],
                                                     assay_measure=ex['assay_measure_method'],
                                                     assay_time_resolved=ex['assay_time_resolved'],
                                                     ligand_function=ex['ligand_function'],
                                                     quantitive_measure_type=ex['quantitive_measure_type'],
                                                     quantitive_activity=ex['quantitive_activity'],
                                                     quantitive_activity_initial=ex['quantitive_activity_initial'],
                                                     quantitive_unit=ex['quantitive_unit'],
                                                     qualitative_activity=ex['qualitative_activity'],
                                                     quantitive_efficacy=ex['quantitive_efficacy'],
                                                     efficacy_measure_type=ex['efficacy_measure_type'],
                                                     efficacy_unit=ex['efficacy_unit'],
                                                     potency=ex['potency'],
                                                     t_coefficient=ex['t_coefficient'],
                                                     t_value=ex['t_coefficient_initial'],
                                                     t_factor=ex['t_factor'],
                                                     log_bias_factor=ex['log_bias_factor'],
                                                     emax_ligand_reference=emax_ligand
                                                     )
                    experiment_assay.save()
                    # print('saved')
            else:
                pass
                # print("already defined")
            # except Exception as msg:
            #     print('\n---saving error---', msg)
            #     continue
