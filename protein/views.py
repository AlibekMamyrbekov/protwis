from django.shortcuts import get_object_or_404, render, redirect
from django.views import generic
from django.http import JsonResponse, HttpResponse
from django.db.models import Q, F, Func, Value
from django.core.cache import cache
from django.views.decorators.cache import cache_page
from django.urls import reverse

from protein.models import Protein, ProteinConformation, ProteinAlias, ProteinFamily, Gene,ProteinGProteinPair
from residue.models import Residue
from structure.models import Structure, StructureModel
from mutation.models import MutationExperiment
from common.selection import Selection
from common.views import AbsBrowseSelection

import json
from copy import deepcopy
from collections import OrderedDict


class BrowseSelection(AbsBrowseSelection):
    title = 'SELECT A RECEPTOR (FAMILY)'
    description = 'Select a target or family by searching or browsing in the right column.'
    description = 'Select a receptor (family) by searching or browsing in the middle. The selection is viewed to' \
        + ' the right.'
    docs = 'receptors.html'
    target_input=False


@cache_page(60 * 60 * 24 * 7)
def detail(request, slug):
    # get protein
    slug = slug.lower()
    try:
        if Protein.objects.filter(entry_name=slug).exists():
            p = Protein.objects.prefetch_related('web_links__web_resource').get(entry_name=slug, sequence_type__slug='wt')
        else:
            p = Protein.objects.prefetch_related('web_links__web_resource').get(accession=slug.upper(), sequence_type__slug='wt')
    except:
        context = {'protein_no_found': slug}

        return render(request, 'protein/protein_detail.html', context)


    if p.family.slug.startswith('100') or p.family.slug.startswith('200'):
        # If this protein is a gprotein, redirect to that page.
        return redirect(reverse('signprotdetail', kwargs={'slug': slug}))

    # get family list
    pf = p.family
    families = [pf.name]
    while pf.parent.parent:
        families.append(pf.parent.name)
        pf = pf.parent
    families.reverse()

    # get default conformation
    pc = ProteinConformation.objects.get(protein=p)

    # get protein aliases
    aliases = ProteinAlias.objects.filter(protein=p).values_list('name', flat=True)

    # get genes
    genes = Gene.objects.filter(proteins=p).values_list('name', flat=True)
    gene = genes[0]
    alt_genes = genes[1:]

    # get structures of this protein
    structures = Structure.objects.filter(protein_conformation__protein__parent=p).order_by('-representative',
        'resolution')

    # get residues
    residues = Residue.objects.filter(protein_conformation=pc).order_by('sequence_number').prefetch_related(
        'protein_segment', 'generic_number', 'display_generic_number')

    mutations = MutationExperiment.objects.filter(protein=p)

    protein_links = p.web_links.all().distinct('web_resource__slug')

    # process residues and return them in chunks of 10
    # this is done for easier scaling on smaller screens
    chunk_size = 10
    r_chunks = []
    r_buffer = []
    last_segment = False
    border = False
    title_cell_skip = 0
    for i, r in enumerate(residues):
        # title of segment to be written out for the first residue in each segment
        segment_title = False

        # keep track of last residues segment (for marking borders)
        if r.protein_segment.slug != last_segment:
            last_segment = r.protein_segment.slug
            border = True

        # if on a border, is there room to write out the title? If not, write title in next chunk
        if i == 0 or (border and len(last_segment) <= (chunk_size - i % chunk_size)):
            segment_title = True
            border = False
            title_cell_skip += len(last_segment) # skip cells following title (which has colspan > 1)

        if i and i % chunk_size == 0:
            r_chunks.append(r_buffer)
            r_buffer = []

        r_buffer.append((r, segment_title, title_cell_skip))

        # update cell skip counter
        if title_cell_skip > 0:
            title_cell_skip -= 1
    if r_buffer:
        r_chunks.append(r_buffer)

    homology_models = StructureModel.objects.filter(protein=p)

    context = {'p': p, 'families': families, 'r_chunks': r_chunks, 'chunk_size': chunk_size, 'aliases': aliases,
        'gene': gene, 'alt_genes': alt_genes, 'structures': structures, 'mutations': mutations, 'protein_links': protein_links,'homology_models': homology_models}

    return render(request, 'protein/protein_detail.html', context)

def SelectionAutocomplete(request):

    if request.is_ajax():
        q = request.GET.get('term')
        type_of_selection = request.GET.get('type_of_selection')
        selection_only_receptors = request.GET.get('selection_only_receptors')
        referer = request.META.get('HTTP_REFERER')

        if 'gproteinselection' in str(referer) or 'signprot' in str(referer) and not 'ginterface' in str(referer):
            exclusion_slug = '00'
        else:
            exclusion_slug = '100'

        results = []

        # session
        simple_selection = request.session.get('selection')
        selection = Selection()
        if simple_selection:
            selection.importer(simple_selection)

        # species filter
        species_list = []
        for species in selection.species:
            species_list.append(species.item)

        # annotation filter
        protein_source_list = []
        for protein_source in selection.annotation:
            protein_source_list.append(protein_source.item)

        # find proteins
        if type_of_selection!='navbar':
            ps = Protein.objects.filter(Q(name__icontains=q) | Q(entry_name__icontains=q),
                species__in=(species_list),
                source__in=(protein_source_list)).exclude(family__slug__startswith=exclusion_slug)[:10]
        else:
            ps = Protein.objects.filter(Q(name__icontains=q) | Q(entry_name__icontains=q) | Q(family__name__icontains=q) | Q(accession=q),
                species__common_name='Human', source__name='SWISSPROT').exclude(family__slug__startswith=exclusion_slug)[:10]

        # Try matching protein name after stripping html tags
        if ps.count() == 0:
            ps = Protein.objects.annotate(filtered=Func(F('name'), Value('<[^>]+>'), Value(''), Value('gi'), function='regexp_replace')).filter(Q(filtered__icontains=q), species__common_name='Human', source__name='SWISSPROT')

        for p in ps:
            p_json = {}
            p_json['id'] = p.id
            p_json['label'] = p.name + " [" + p.species.common_name + "]"
            p_json['slug'] = p.entry_name
            p_json['type'] = 'protein'
            p_json['category'] = 'Targets'
            results.append(p_json)


        if type_of_selection!='navbar':
            # find protein aliases
            pas = ProteinAlias.objects.prefetch_related('protein').filter(name__icontains=q,
                protein__species__in=(species_list),
                protein__source__in=(protein_source_list)).exclude(protein__family__slug__startswith=exclusion_slug)[:10]
            for pa in pas:
                pa_json = {}
                pa_json['id'] = pa.protein.id
                pa_json['label'] = pa.protein.name  + " [" + pa.protein.species.common_name + "]"
                pa_json['slug'] = pa.protein.entry_name
                pa_json['type'] = 'protein'
                pa_json['category'] = 'Targets'
                if pa_json not in results:
                    results.append(pa_json)

            # protein families
            if (type_of_selection == 'targets' or type_of_selection == 'browse' or type_of_selection == 'gproteins') and selection_only_receptors!="True":
                # find protein families
                pfs = ProteinFamily.objects.filter(name__icontains=q).exclude(slug='000').exclude(slug__startswith=exclusion_slug)[:10]

                # Try matching protein family name after stripping html tags
                if pfs.count() == 0:
                    pfs = ProteinFamily.objects.annotate(filtered=Func(F('name'), Value('<[^>]+>'), Value(''), Value('gi'), function='regexp_replace')).filter(filtered__icontains=q).exclude(slug='000').exclude(slug__startswith=exclusion_slug)[:10]

                for pf in pfs:
                    pf_json = {}
                    pf_json['id'] = pf.id
                    pf_json['label'] = pf.name
                    pf_json['slug'] = pf.slug
                    pf_json['type'] = 'family'
                    pf_json['category'] = 'Target families'
                    results.append(pf_json)

        data = json.dumps(results)
    else:
        data = 'fail'
    mimetype = 'application/json'
    return HttpResponse(data, mimetype)


def g_proteins(request, **response_kwargs):
    ''' Example of g_proteins '''
    proteins = Protein.objects.filter(source__name='SWISSPROT').prefetch_related('proteingproteinpair_set')
    jsondata = {}
    for p in proteins:
        gps = p.proteingproteinpair_set.all()
        if gps:
            jsondata[str(p)] = []
            for gp in gps:
                jsondata[str(p)].append(str(gp))
    jsondata = json.dumps(jsondata)
    response_kwargs['content_type'] = 'application/json'
    return HttpResponse(jsondata, **response_kwargs)

# @cache_page(60*60*24*7)
def isoforms(request):

    context = dict()

    families = ProteinFamily.objects.all()
    lookup = {}
    for f in families:
        lookup[f.slug] = f.name.replace("receptors","").replace(" receptor","").replace(" hormone","").replace("/neuropeptide","/").replace(" (G protein-coupled)","").replace(" factor","").replace(" (LPA)","").replace(" (S1P)","").replace("GPR18, GPR55 and GPR119","GPR18/55/119").replace("-releasing","").replace(" peptide","").replace(" and oxytocin","/Oxytocin").replace("Adhesion class orphans","Adhesion orphans").replace("muscarinic","musc.").replace("-concentrating","-conc.")

    class_proteins = Protein.objects.filter(family__slug__startswith="00",source__name='SWISSPROT', species_id=1).prefetch_related('family').order_by('family__slug')

    temp = OrderedDict([
                    ('name',''),
                    ('number_of_variants', 0),
                    ('number_of_children', 0),
                    ('receptor_t',0),
                    ('density_of_variants', 0),
                    ('children', OrderedDict())
                    ])

    coverage = OrderedDict()

    filepath = 'protein/data/Isoform_annotation_table.txt'
    filepath = 'protein/data/Phylogenetic_tree_isoform_diversity_table.txt'
    receptor_isoforms = {}
    max_isoforms = 0
    max_level_1 = 0
    max_level_2 = 0
    max_level_3 = 0
    with open(filepath, "r", encoding='UTF-8') as f:
        for row in f:
            c = row.split("\t")
            r = c[2]
            isoforms = c[6]
            if isoforms!='mean_isoforms_per_class_ligand_type_family':
                receptor_isoforms[r] = int(isoforms)
                if int(isoforms)>max_isoforms:
                    max_isoforms = int(isoforms)

    # Make the scaffold
    for p in class_proteins:
        e_short = p.entry_name.split("_")[0].upper()
        fid = p.family.slug.split("_")
        if fid[0] not in coverage:
            coverage[fid[0]] = deepcopy(temp)
            coverage[fid[0]]['name'] = lookup[fid[0]]
        if fid[1] not in coverage[fid[0]]['children']:
            coverage[fid[0]]['children'][fid[1]] = deepcopy(temp)
            coverage[fid[0]]['children'][fid[1]]['name'] = lookup[fid[0]+"_"+fid[1]]
        if fid[2] not in coverage[fid[0]]['children'][fid[1]]['children']:
            coverage[fid[0]]['children'][fid[1]]['children'][fid[2]] = deepcopy(temp)
            coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['name'] = lookup[fid[0]+"_"+fid[1]+"_"+fid[2]][:28]
        if fid[3] not in coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['children']:
            coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['children'][fid[3]] = deepcopy(temp)
            coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['children'][fid[3]]['name'] = p.entry_name.split("_")[0] #[:10]
            coverage[fid[0]]['receptor_t'] += 1
            coverage[fid[0]]['children'][fid[1]]['receptor_t'] += 1
            coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['receptor_t'] += 1
            coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['children'][fid[3]]['receptor_t'] = 1

            if e_short in receptor_isoforms:
                coverage[fid[0]]['number_of_variants'] += receptor_isoforms[e_short]
                coverage[fid[0]]['children'][fid[1]]['number_of_variants'] += receptor_isoforms[e_short]
                coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['number_of_variants'] += receptor_isoforms[e_short]
                coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['children'][fid[3]]['number_of_variants'] = receptor_isoforms[e_short]
                coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['children'][fid[3]]['density_of_variants'] = round(receptor_isoforms[e_short]/max_isoforms,2)

                if coverage[fid[0]]['number_of_variants']>max_level_1:
                    max_level_1 = coverage[fid[0]]['number_of_variants']
                if coverage[fid[0]]['children'][fid[1]]['number_of_variants']>max_level_2:
                    max_level_2 = coverage[fid[0]]['children'][fid[1]]['number_of_variants']
                if coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['number_of_variants']>max_level_3:
                    max_level_3 = coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['number_of_variants']

    # Make the scaffold
    for p in class_proteins:
        e_short = p.entry_name.split("_")[0].upper()
        fid = p.family.slug.split("_")
        coverage[fid[0]]['density_of_variants'] = round(coverage[fid[0]]['number_of_variants']/max_level_1,2)
        coverage[fid[0]]['children'][fid[1]]['density_of_variants'] = round(coverage[fid[0]]['children'][fid[1]]['number_of_variants']/max_level_2,2)
        coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['density_of_variants'] = round(coverage[fid[0]]['children'][fid[1]]['children'][fid[2]]['number_of_variants']/max_level_3,2)


    # MAKE THE TREE
    tree = OrderedDict({'name':'GPCRs','children':[]})
    i = 0
    n = 0
    for c,c_v in coverage.items():
        c_v['name'] = c_v['name'].split("(")[0]
        if c_v['name'].strip() in ['Other GPCRs']:
            continue
        children = []
        for lt,lt_v in c_v['children'].items():
            if lt_v['name'].strip() == 'Orphan' and c_v['name'].strip()=="Class A":
                continue
            children_rf = []
            for rf,rf_v in lt_v['children'].items():
                rf_v['name'] = rf_v['name'].split("<")[0]
                children_r = []
                for r,r_v in rf_v['children'].items():
                    r_v['sort'] = n
                    children_r.append(r_v)
                    n += 1
                rf_v['children'] = children_r
                rf_v['sort'] = n
                children_rf.append(rf_v)
            lt_v['children'] = children_rf
            lt_v['sort'] = n
            children.append(lt_v)
        c_v['children'] = children
        c_v['sort'] = n
        tree['children'].append(c_v)
        i += 1

    context['tree'] = json.dumps(tree)

    filepath = 'protein/data/Isoform_annotation_table.txt'
    table_data = []
    with open(filepath, "r", encoding='UTF-8') as f:
        for row in f:
            c = row.split("\t")
            table_data.append(c)

    context['table_data'] = json.dumps(table_data)

    return render(request, 'protein/isoforms.html', context)

def AlignIsoformWildtype(request):

    p = request.GET.get("protein")
    es = request.GET.getlist("ensembl_id[]")
    data = {}
    data['isoforms'] = {}
    protein = Protein.objects.get(entry_name__startswith=p.lower(), sequence_type__slug='wt', species__common_name='Human')
    parent_seq = protein.sequence
    rs = Residue.objects.filter(protein_conformation__protein=protein).prefetch_related('protein_segment','display_generic_number','generic_number')
    data['res'] = {}
    for r in rs:
        data['res'][r.sequence_number] = [r.protein_segment.slug,str(r.display_generic_number), r.sequence_number]

    from common.tools import fetch_from_web_api
    from Bio import pairwise2
    from Bio.SubsMat import MatrixInfo as matlist
    from Bio.Align.Applications import ClustalOmegaCommandline
    from Bio import AlignIO
    cache_dir = ['ensembl', 'isoform']
    url = 'https://rest.ensembl.org/sequence/id/$index?content-type=application/json&type=protein'
    for e in es:
        isoform_info = fetch_from_web_api(url, e, cache_dir)
        if (isoform_info):
            seq = isoform_info['seq']
            seq_filename = "/tmp/" + e + ".fa"
            with open(seq_filename, 'w') as seq_file:
                seq_file.write("> ref\n")
                seq_file.write(parent_seq + "\n")
                seq_file.write("> seq\n")
                seq_file.write(seq + "\n")

            ali_filename = "/tmp/"+e +"_out.fa"
            acmd = ClustalOmegaCommandline(infile=seq_filename, outfile=ali_filename, force=True)
            stdout, stderr = acmd()
            pw2 = AlignIO.read(ali_filename, "fasta")
            aln_human = str(pw2[0].seq)
            aln_isoform = str(pw2[1].seq)
            data['wt'] = aln_human
            data['isoforms'][e]=aln_isoform
            with open (seq_filename, "r") as myfile:
                fasta=myfile.readlines()
            data['fasta'] = fasta
            gaps = 0
            data['res_correct'] = {}
            for i, r in enumerate(data['wt'], 1):
                if r == "-":
                    data['res_correct'][i] = ['','','']
                    gaps += 1
                else:
                    data['res_correct'][i] = data['res'][i-gaps]
        else:
            print('error fetching info from',e)


    return JsonResponse(data)
    #https://rest.ensembl.org/sequence/id/ENST00000506598?content-type=application/json&type=protein
